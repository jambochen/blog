import type { Link, Root } from 'mdast';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';
import { describe, expect, it } from 'vitest';
import { catalogue } from './catalogue.ts';
import { linkWikilinks, type PostSource } from './wikilinks.ts';

const parser = unified().use(remarkParse).use(remarkGfm).use(remarkMath);

function post(id: string, title: string, body = '', rest: Partial<PostSource> = {}): PostSource {
	return {
		id,
		title,
		body,
		path: `/content/${id}.md`,
		url: `/${id}/`,
		description: `about ${title}`,
		extension: '.md',
		draft: false,
		pubDate: 0,
		...rest,
	};
}

// Links the body of the post with `id` and returns what a reader would get.
interface Site {
	showDrafts?: boolean;
	seriesNames?: Record<string, string>;
}

function linked(posts: PostSource[], id: string, { showDrafts = false, seriesNames = {} }: Site = {}) {
	const self = posts.find((candidate) => candidate.id === id);
	if (!self) throw new Error(`no post ${id}`);
	const tree: Root = parser.parse(self.body);
	const registry = Object.fromEntries(
		Object.entries(seriesNames).map(([key, name]) => [key, { name, tone: 'page' as const }]),
	);
	linkWikilinks(
		tree,
		self.path,
		catalogue(
			posts.map((post) => ({ ...post, post })),
			registry,
			showDrafts,
		),
	);

	const links: { url: string; text: string; data: Record<string, unknown> }[] = [];
	visit(tree, 'link', (node: Link) => {
		const [child] = node.children;
		links.push({
			url: node.url,
			text: child?.type === 'text' ? child.value : '',
			data: (node.data as { hProperties?: Record<string, unknown> } | undefined)?.hProperties ?? {},
		});
	});
	let text = '';
	visit(tree, 'text', (node) => {
		text += node.value;
	});
	return { links, text };
}

describe('linkWikilinks', () => {
	it('links a title to its post and shows the title', () => {
		const { links } = linked([post('a', 'A', 'See [[B]].'), post('b', 'B')], 'a');
		expect(links).toEqual([
			{
				url: '/b/',
				text: 'B',
				data: { className: ['xref'], 'data-title': 'B', 'data-note': 'about B', 'data-place': '' },
			},
		]);
	});

	it('links a heading of the same post without leaving the page', () => {
		const { links } = linked([post('a', 'A', 'See [[#Later]].\n\n## Later\n\nThe summary.')], 'a');
		expect(links[0]).toMatchObject({
			url: '#later',
			text: '「Later」',
			data: { 'data-section': 'Later', 'data-note': 'The summary.', 'data-place': '本篇' },
		});
	});

	it('links a heading of another post', () => {
		const { links } = linked([post('a', 'A', '[[B#Part]]'), post('b', 'B', '## Part\n\nBody.')], 'a');
		expect(links[0]).toMatchObject({ url: '/b/#part', text: '「Part」', data: { 'data-title': 'B' } });
	});

	it('shows the text after the bar as written', () => {
		const { links } = linked([post('a', 'A', '[[B#Part|over there]]'), post('b', 'B', '## Part')], 'a');
		expect(links[0]?.text).toBe('over there');
	});

	it('matches a heading by its text without backticks', () => {
		const { links } = linked([post('a', 'A', '[[#Use git add]]\n\n## Use `git add`')], 'a');
		expect(links[0]).toMatchObject({ url: '#use-git-add', text: '「Use git add」' });
	});

	it('numbers a repeated heading the way the rendered page does', () => {
		const body = '[[#Second]]\n\n## Same\n\n> ## Same\n\n## Second';
		const posts = [post('a', 'A', body), post('b', 'B', '[[A#Same]]')];
		expect(linked(posts, 'b').links[0]?.url).toBe('/a/#same');
		expect(linked(posts, 'a').links[0]?.url).toBe('#second');
	});

	describe('the note of a section', () => {
		const note = (body: string) =>
			linked([post('a', 'A', `[[#H]]\n\n## H\n\n${body}`), post('b', 'B', '## Part')], 'a').links[0]?.data['data-note'];

		it('is the first paragraph, cut at 80 characters', () => {
			expect(note('x'.repeat(81))).toBe(`${'x'.repeat(80)}…`);
		});

		it('is the first item when the section opens with a list', () => {
			expect(note('- first\n- second')).toBe('first');
		});

		it('passes over a quote to the first paragraph', () => {
			expect(note('> quoted\n\nA paragraph.')).toBe('A paragraph.');
		});

		it('is empty when the section holds no paragraph or list', () => {
			expect(note('> quoted')).toBe('');
		});

		it('shows a wikilink in it as the reader would see it', () => {
			expect(note('Read [[B#Part|this]] and [[B#Part]].')).toBe('Read this and Part.');
		});
	});

	describe('the place of the target', () => {
		const posts = [
			post('s/one', 'One', '[[Two]] [[Other]] [[Alone]]', { seriesOrder: 1 }),
			post('s/two', 'Two', '', { seriesOrder: 2 }),
			post('t/other', 'Other'),
			post('alone', 'Alone'),
		];
		const places = (site: Site = {}) =>
			linked(posts, 's/one', site).links.map(({ data }) => data['data-place']);

		it('is the episode number inside the same series', () => {
			expect(places()[0]).toBe('第 2 篇');
		});

		it('names the series when the target is in another one', () => {
			expect(places({ seriesNames: { t: 'Tea' } })[1]).toBe('Tea · 第 1 篇');
			expect(places()[1]).toBe('t · 第 1 篇');
		});

		it('is empty for a standalone post', () => {
			expect(places()[2]).toBe('');
		});
	});

	describe('a draft target', () => {
		const posts = [post('a', 'A', 'See [[B]].'), post('b', 'B', '', { draft: true })];

		it('is plain text where drafts are hidden', () => {
			expect(linked(posts, 'a')).toEqual({ links: [], text: 'See B.' });
		});

		it('is a link where drafts are shown', () => {
			expect(linked(posts, 'a', { showDrafts: true }).links[0]?.url).toBe('/b/');
		});
	});

	describe('a reference that matches nothing', () => {
		const failure = (body: string, others: PostSource[] = []) => () => linked([post('a', 'A', body), ...others], 'a');

		it('fails on an unknown title', () => {
			expect(failure('[[Nowhere]]')).toThrow('[[Nowhere]] names no post');
		});

		it('fails on an unknown heading', () => {
			expect(failure('[[B#Gone]]', [post('b', 'B')])).toThrow('[[B#Gone]] names no section of /content/b.md');
		});

		it('fails when it names nothing', () => {
			expect(failure('[[]]')).toThrow('names neither a post nor a section');
		});

		it('fails when inline code breaks it up', () => {
			expect(failure('[[#Use `git add`]]\n\n## Use `git add`')).toThrow('holds an incomplete reference');
		});

		it('fails when two posts share a title', () => {
			expect(failure('', [post('b', 'Same'), post('c', 'Same')])).toThrow('"Same" is the title of both');
		});
	});
});
