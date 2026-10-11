import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseFrontmatter } from '@astrojs/markdown-remark';
import GithubSlugger, { slug as slugify } from 'github-slugger';

interface MdastNode {
	type: string;
	value?: string;
	url?: string;
	children?: MdastNode[];
	data?: Record<string, unknown>;
}

interface Section {
	text: string;
	slug: string;
}

interface Post {
	path: string;
	title: string;
	url: string;
	draft: boolean;
	sections: Section[];
}

const CONTENT_DIR = resolve('src/content/blog');
const WIKILINK = /\[\[([^[\]|#]*)(?:#([^[\]|]+))?(?:\|([^[\]]+))?\]\]/g;

const failures: string[] = [];

// Astro only logs an error thrown while rendering a `.md` post and builds the
// page empty, where an `.mdx` post stops the build. This stops it for both.
export function wikilinkCheck() {
	return {
		name: 'wikilink-check',
		hooks: {
			'astro:build:done': () => {
				if (failures.length) throw new Error(`Unresolved wikilinks:\n${failures.join('\n')}`);
			},
		},
	};
}

// Has to produce the ids Astro gives the rendered headings, or the links land
// nowhere: Astro slugs a heading's text with inline code kept and formulas
// dropped, and numbers repeated slugs in document order.
function sectionsOf(body: string): Section[] {
	const slugger = new GithubSlugger();
	const sections: Section[] = [];
	let fence: string | undefined;
	for (const line of body.split('\n')) {
		const marker = /^\s*(`{3,}|~{3,})/.exec(line)?.[1];
		if (marker) {
			if (!fence) fence = marker;
			else if (marker[0] === fence[0] && marker.length >= fence.length) fence = undefined;
			continue;
		}
		if (fence) continue;
		const heading = /^#{1,6}\s+(.*\S)\s*$/.exec(line)?.[1];
		if (!heading) continue;
		const text = heading.replaceAll('`', '');
		sections.push({ text, slug: slugger.slug(text.replace(/\$[^$]*\$/g, '')) });
	}
	return sections;
}

// Read on every call rather than once: in `astro dev` a renamed title or
// heading has to reach the posts that refer to it without a restart.
function readPosts(): Post[] {
	const posts: Post[] = [];
	for (const entry of readdirSync(CONTENT_DIR, { recursive: true, encoding: 'utf8' })) {
		const extension = /\.mdx?$/.exec(entry)?.[0];
		if (!extension) continue;
		const path = join(CONTENT_DIR, entry);
		const { frontmatter, content } = parseFrontmatter(readFileSync(path, 'utf8'));
		const id =
			frontmatter.slug ??
			entry
				.slice(0, -extension.length)
				.split(/[\\/]/)
				.map((segment) => slugify(segment))
				.join('/');
		posts.push({
			path,
			title: String(frontmatter.title),
			url: `/blog/${id}/`,
			draft: frontmatter.draft === true,
			sections: sectionsOf(content),
		});
	}
	return posts;
}

// Turns `[[篇名]]`, `[[#標題]]` and `[[篇名#標題]]` into links to posts and their
// sections, with `|` introducing the text to show instead of the default. A
// reference that matches nothing fails the build, so a renamed title or heading
// cannot leave a dead link behind.
export function remarkWikilinks() {
	return (tree: MdastNode, file: { path?: string }) => {
		// Matches `getPosts`: a build leaves drafts out, so a link to one would be dead.
		const isBuild = process.env.NODE_ENV === 'production';
		const fail = (reason: string) => {
			const message = `${file.path}: ${reason}`;
			failures.push(message);
			return new Error(message);
		};

		const posts = readPosts();
		const byTitle = new Map<string, Post>();
		for (const post of posts) {
			const other = byTitle.get(post.title);
			if (other) {
				throw fail(`"${post.title}" is the title of both ${other.path} and ${post.path}`);
			}
			byTitle.set(post.title, post);
		}
		const self = posts.find((post) => post.path === file.path);

		const linkFor = (match: RegExpExecArray): MdastNode => {
			const [source, title = '', heading, label] = match;

			const post = title.trim() ? byTitle.get(title.trim()) : self;
			if (!post) throw fail(`${source} names no post`);
			if (!title.trim() && !heading) throw fail(`${source} names neither a post nor a section`);
			const section = heading && post.sections.find(({ text }) => text === heading.trim());
			if (heading && !section) throw fail(`${source} names no section of ${post.path}`);

			const text: MdastNode = {
				type: 'text',
				value: label ?? (section ? `「${section.text}」` : post.title),
			};
			if (post.draft && isBuild) return text;
			return {
				type: 'link',
				url: (post === self && section ? '' : post.url) + (section ? `#${section.slug}` : ''),
				children: [text],
				data: { hProperties: { className: ['xref'] } },
			};
		};

		const split = (node: MdastNode): MdastNode[] => {
			const value = node.value ?? '';
			const parts: MdastNode[] = [];
			let end = 0;
			for (const match of value.matchAll(WIKILINK)) {
				if (match.index > end) parts.push({ type: 'text', value: value.slice(end, match.index) });
				parts.push(linkFor(match));
				end = match.index + match[0].length;
			}
			if (end < value.length) parts.push({ type: 'text', value: value.slice(end) });
			// A reference broken up by inline code or a formula never matches the
			// pattern, and would otherwise reach the page as literal brackets.
			const stray = parts.find((part) => part.type === 'text' && part.value?.includes('[['));
			if (stray) throw fail(`"${stray.value}" holds an incomplete reference`);
			return parts;
		};

		const visit = (node: MdastNode) => {
			if (!node.children) return;
			node.children = node.children.flatMap((child) => {
				if (child.type === 'text' && child.value?.includes('[[')) return split(child);
				visit(child);
				return [child];
			});
		};
		visit(tree);
	};
}
