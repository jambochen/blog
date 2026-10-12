import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseFrontmatter } from '@astrojs/markdown-remark';
import GithubSlugger, { slug as slugify } from 'github-slugger';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkMdx from 'remark-mdx';
import remarkParse from 'remark-parse';
import { unified } from 'unified';

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
	excerpt: string;
}

interface Post {
	path: string;
	title: string;
	description: string;
	url: string;
	draft: boolean;
	series?: string;
	seriesOrder?: number;
	pubDate: number;
	// Position in its series, counted over the posts a reader can open.
	episode?: number;
	sections: Section[];
}

const EXCERPT_LENGTH = 80;

// The syntax Astro reads the posts with, so a heading here is a heading there.
const markdown = unified().use(remarkParse).use(remarkGfm).use(remarkMath);
// Kept apart because MDX rejects a stray `<` or `{`, which a `.md` post may hold.
const mdx = markdown().use(remarkMdx);

// A node's text without its markup. Raw HTML tags and images add nothing, as on
// the rendered page; `formulas` keeps the LaTeX source, which the page's ids drop.
function textOf(node: MdastNode, formulas: boolean): string {
	if (node.type === 'inlineMath') return formulas ? `$${node.value}$` : '';
	if (node.type === 'html' || node.type === 'image') return '';
	return node.children?.map((child) => textOf(child, formulas)).join('') ?? node.value ?? '';
}

// Figures, tables, quotes and display math do not read as a summary, so only a
// paragraph or the first item of a list gives one.
function excerptOf(node: MdastNode): string {
	const lead = node.type === 'list' ? node.children?.[0]?.children?.[0] : node;
	if (lead?.type !== 'paragraph') return '';
	const prose = textOf(lead, true)
		.replace(/\[\[(?:[^[\]|]*\|)?([^[\]|]*)\]\]/g, (_, shown: string) => shown.replace(/^.*#/, ''))
		.trim();
	return prose.length > EXCERPT_LENGTH ? `${prose.slice(0, EXCERPT_LENGTH)}…` : prose;
}

const CONTENT_DIR = resolve('src/content/blog');
const SERIES_FILE = resolve('src/content/series.json');
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
function sectionsOf(body: string, extension: string): Section[] {
	const slugger = new GithubSlugger();
	const sections: Section[] = [];
	const visit = (parent: MdastNode, nested: boolean) => {
		for (const node of parent.children ?? []) {
			if (node.type === 'heading') {
				sections.push({ text: textOf(node, true), slug: slugger.slug(textOf(node, false)), excerpt: '' });
				continue;
			}
			const section = sections.at(-1);
			if (section && !section.excerpt && !nested) section.excerpt = excerptOf(node);
			// Astro numbers the headings inside quotes and components along with the rest.
			visit(node, true);
		}
	};
	visit((extension === '.mdx' ? mdx : markdown).parse(body) as MdastNode, false);
	return sections;
}

// Read on every call rather than once: in `astro dev` a renamed title or
// heading has to reach the posts that refer to it without a restart.
function readPosts(isBuild: boolean, base: string): Post[] {
	const posts: Post[] = [];
	for (const entry of readdirSync(CONTENT_DIR, { recursive: true, encoding: 'utf8' })) {
		const extension = /\.mdx?$/.exec(entry)?.[0];
		if (!extension) continue;
		const path = join(CONTENT_DIR, entry);
		const { frontmatter, content } = parseFrontmatter(readFileSync(path, 'utf8'));
		const segments = entry
			.slice(0, -extension.length)
			.split(/[\\/]/)
			.map((segment) => slugify(segment));
		const id = frontmatter.slug ?? segments.join('/');
		posts.push({
			path,
			title: String(frontmatter.title),
			description: String(frontmatter.description ?? ''),
			url: `${base}/blog/${id}/`,
			draft: frontmatter.draft === true,
			// The folder, as in `seriesOf`.
			series: segments.length > 1 ? segments[0] : undefined,
			seriesOrder: frontmatter.seriesOrder,
			pubDate: new Date(frontmatter.pubDate).valueOf(),
			sections: sectionsOf(content, extension),
		});
	}

	// Has to number episodes the way `getEpisodes` does, or the number beside a
	// link would disagree with the one on the page it opens.
	const series = new Map<string, Post[]>();
	for (const post of posts) {
		if (!post.series || (isBuild && post.draft)) continue;
		series.set(post.series, [...(series.get(post.series) ?? []), post]);
	}
	for (const members of series.values()) {
		members
			.sort((a, b) => {
				if (a.seriesOrder !== undefined && b.seriesOrder !== undefined) {
					return a.seriesOrder - b.seriesOrder;
				}
				if (a.seriesOrder !== undefined) return -1;
				if (b.seriesOrder !== undefined) return 1;
				return a.pubDate - b.pubDate;
			})
			.forEach((post, index) => {
				post.episode = index + 1;
			});
	}
	return posts;
}

// Turns `[[篇名]]`, `[[#標題]]` and `[[篇名#標題]]` into links to posts and their
// sections, with `|` introducing the text to show instead of the default. A
// reference that matches nothing fails the build, so a renamed title or heading
// cannot leave a dead link behind.
export function remarkWikilinks({ base = '' }: { base?: string } = {}) {
	return (tree: MdastNode, file: { path?: string }) => {
		// Matches `getPosts`: a build leaves drafts out, so a link to one would be dead.
		const isBuild = process.env.NODE_ENV === 'production';
		const fail = (reason: string) => {
			const message = `${file.path}: ${reason}`;
			failures.push(message);
			return new Error(message);
		};

		const posts = readPosts(isBuild, base);
		const byTitle = new Map<string, Post>();
		for (const post of posts) {
			const other = byTitle.get(post.title);
			if (other) {
				throw fail(`"${post.title}" is the title of both ${other.path} and ${post.path}`);
			}
			byTitle.set(post.title, post);
		}
		const self = posts.find((post) => post.path === file.path);

		// An episode number means little without its series, so the series is
		// named unless the reader is already inside it.
		const placeOf = (post: Post): string => {
			if (post === self) return '本篇';
			if (!post.episode) return '';
			const position = `第 ${post.episode} 篇`;
			if (post.series === self?.series) return position;
			const names: Record<string, { name: string }> = JSON.parse(readFileSync(SERIES_FILE, 'utf8'));
			return `${names[post.series ?? '']?.name ?? post.series} · ${position}`;
		};

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
				data: {
					hProperties: {
						className: ['xref'],
						'data-title': post.title,
						'data-note': section ? section.excerpt : post.description,
						...(section && { 'data-section': section.text }),
						'data-place': placeOf(post),
					},
				},
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
