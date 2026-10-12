import { describe, expect, it } from 'vitest';
import type { Content, PostFile } from './contentOnDisk.ts';
import { contentProblems } from './contentProblems.ts';

function post(id: string, title: string, body = '', rest: Partial<PostFile> = {}): PostFile {
	return {
		id,
		title,
		body,
		path: `blog/${id}.md`,
		description: '',
		extension: '.md',
		draft: false,
		pubDate: 0,
		...rest,
	};
}

function content(posts: PostFile[], series: string[] = []): Content {
	return {
		posts,
		series: Object.fromEntries(series.map((key) => [key, { name: key, tone: 'page' as const }])),
		reserved: new Map([['about', 'the page src/pages/about']]),
	};
}

describe('contentProblems', () => {
	it('finds none in content that keeps every rule', () => {
		const posts = [post('s/a', 'A', 'See [[B#Part]].'), post('s/b', 'B', '## Part'), post('alone', 'Alone')];
		expect(contentProblems(content(posts, ['s']), false)).toEqual([]);
	});

	it('reports the mistakes of every kind together', () => {
		const posts = [post('s/a', 'A', 'See [[Nowhere]].'), post('about', 'About', '[[A#Gone]]')];
		expect(contentProblems(content(posts), false)).toEqual([
			'blog/s/a.md: folder "s" is not in src/content/series.json',
			'blog/about.md: "about" is already the page src/pages/about',
			'blog/about.md: [[A#Gone]] names no section of blog/s/a.md',
			'blog/s/a.md: [[Nowhere]] names no post',
		]);
	});

	it('reports two posts with one title once, not at every post', () => {
		const posts = [post('a', 'Same'), post('b', 'Same'), post('c', 'C')];
		expect(contentProblems(content(posts), false)).toEqual(['"Same" is the title of both blog/a.md and blog/b.md']);
	});

	it('lists the broken wikilinks beside a repeated title', () => {
		const posts = [post('a', 'Same'), post('b', 'Same'), post('c', 'C', '[[Nowhere]]')];
		expect(contentProblems(content(posts), false)).toEqual([
			'"Same" is the title of both blog/a.md and blog/b.md',
			'blog/c.md: [[Nowhere]] names no post',
		]);
	});

	it('checks the wikilinks of a hidden draft too', () => {
		const posts = [post('a', 'A', '[[Nowhere]]', { draft: true })];
		expect(contentProblems(content(posts), false)).toEqual(['blog/a.md: [[Nowhere]] names no post']);
	});

	it('checks an MDX post with the MDX syntax', () => {
		const posts = [post('a', 'A', '<Figure />\n\n[[Nowhere]]', { extension: '.mdx' })];
		expect(contentProblems(content(posts), false)).toEqual(['blog/a.md: [[Nowhere]] names no post']);
	});
});
