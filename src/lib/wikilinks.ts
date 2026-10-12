import GithubSlugger from 'github-slugger';
import type { Link, Nodes, Root } from 'mdast';
import { findAndReplace } from 'mdast-util-find-and-replace';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkMdx from 'remark-mdx';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';
import { isVisible, type PostRecord, placeEpisodes, seriesOf } from './series.ts';

export interface PostSource extends PostRecord {
	path: string;
	title: string;
	description: string;
	url: string;
	// The Markdown under the frontmatter.
	body: string;
	extension: string;
}

export interface Site {
	posts: PostSource[];
	showDrafts: boolean;
	// By series key; a series without a name is shown by its key.
	seriesNames: Record<string, string>;
}

interface Section {
	text: string;
	slug: string;
	excerpt: string;
}

interface Target extends PostSource {
	series?: string;
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
function textOf(node: Nodes, formulas: boolean): string {
	if (node.type === 'inlineMath') return formulas ? `$${node.value}$` : '';
	if (node.type === 'html' || node.type === 'image') return '';
	if ('children' in node) return node.children.map((child) => textOf(child, formulas)).join('');
	return 'value' in node ? node.value : '';
}

// Figures, tables, quotes and display math do not read as a summary, so only a
// paragraph or the first item of a list gives one.
function excerptOf(node: Nodes): string {
	const lead = node.type === 'list' ? node.children[0]?.children[0] : node;
	if (lead?.type !== 'paragraph') return '';
	const prose = textOf(lead, true)
		.replace(/\[\[(?:[^[\]|]*\|)?([^[\]|]*)\]\]/g, (_, shown: string) => shown.replace(/^.*#/, ''))
		.trim();
	return prose.length > EXCERPT_LENGTH ? `${prose.slice(0, EXCERPT_LENGTH)}…` : prose;
}

const WIKILINK = /\[\[([^[\]|#]*)(?:#([^[\]|]+))?(?:\|([^[\]]+))?\]\]/g;

// Has to produce the ids Astro gives the rendered headings, or the links land
// nowhere: Astro slugs a heading's text with inline code kept and formulas
// dropped, and numbers repeated slugs in document order.
function sectionsOf(body: string, extension: string): Section[] {
	const slugger = new GithubSlugger();
	const sections: Section[] = [];
	const collect = (parent: Nodes, nested: boolean) => {
		if (!('children' in parent)) return;
		for (const node of parent.children) {
			if (node.type === 'heading') {
				sections.push({ text: textOf(node, true), slug: slugger.slug(textOf(node, false)), excerpt: '' });
				continue;
			}
			const section = sections.at(-1);
			if (section && !section.excerpt && !nested) section.excerpt = excerptOf(node);
			// Astro numbers the headings inside quotes and components along with the rest.
			collect(node, true);
		}
	};
	collect((extension === '.mdx' ? mdx : markdown).parse(body), false);
	return sections;
}

// Turns `[[篇名]]`, `[[#標題]]` and `[[篇名#標題]]` in the post at `path` into
// links to posts and their sections, with `|` introducing the text to show
// instead of the default. Throws at a reference that matches nothing, so a
// renamed title or heading cannot leave a dead link behind.
export function linkWikilinks(tree: Root, path: string | undefined, site: Site): void {
	const placements = placeEpisodes(site.posts, site.showDrafts);
	const posts: Target[] = site.posts.map((post) => ({
		...post,
		series: seriesOf(post.id),
		episode: placements.get(post.id)?.number,
		sections: sectionsOf(post.body, post.extension),
	}));

	const byTitle = new Map<string, Target>();
	for (const post of posts) {
		const other = byTitle.get(post.title);
		if (other) throw new Error(`"${post.title}" is the title of both ${other.path} and ${post.path}`);
		byTitle.set(post.title, post);
	}
	const self = posts.find((post) => post.path === path);

	// An episode number means little without its series, so the series is
	// named unless the reader is already inside it.
	const placeOf = (post: Target): string => {
		if (post === self) return '本篇';
		if (!post.episode) return '';
		const position = `第 ${post.episode} 篇`;
		if (post.series === self?.series) return position;
		return `${site.seriesNames[post.series ?? ''] ?? post.series} · ${position}`;
	};

	const linkFor = (source: string, title = '', heading?: string, label?: string): Link | string => {
		const post = title.trim() ? byTitle.get(title.trim()) : self;
		if (!post) throw new Error(`${source} names no post`);
		if (!title.trim() && !heading) throw new Error(`${source} names neither a post nor a section`);
		const section = heading && post.sections.find(({ text }) => text === heading.trim());
		if (heading && !section) throw new Error(`${source} names no section of ${post.path}`);

		const text = label ?? (section ? `「${section.text}」` : post.title);
		// The page of a hidden draft is not built, so a link to it would be dead.
		if (!isVisible(post, site.showDrafts)) return text;
		return {
			type: 'link',
			url: (post === self && section ? '' : post.url) + (section ? `#${section.slug}` : ''),
			children: [{ type: 'text', value: text }],
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

	findAndReplace(tree, [WIKILINK, linkFor]);
	// A reference broken up by inline code or a formula never matches the
	// pattern, and would otherwise reach the page as literal brackets.
	visit(tree, 'text', ({ value }) => {
		if (value.includes('[[')) throw new Error(`"${value}" holds an incomplete reference`);
	});
}
