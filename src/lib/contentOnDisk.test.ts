import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readContent } from './contentOnDisk.ts';

function content(files: Record<string, string>): string {
	const root = mkdtempSync(join(tmpdir(), 'content-'));
	for (const [name, text] of Object.entries({ 'series.json': '{}', ...files })) {
		mkdirSync(dirname(join(root, name)), { recursive: true });
		writeFileSync(join(root, name), text);
	}
	return root;
}

const post = (frontmatter: string, body = '') =>
	`---\ntitle: T\ndescription: D\npubDate: 2026-01-02\n${frontmatter}---\n${body}`;

describe('readContent', () => {
	it('reads Markdown and MDX posts and nothing else', () => {
		const root = content({ 'blog/a.md': post(''), 'blog/b.mdx': post(''), 'blog/img/c.svg': '<svg/>' });
		expect(readContent(root).posts.map(({ id, extension }) => [id, extension])).toEqual(
			expect.arrayContaining([
				['a', '.md'],
				['b', '.mdx'],
			]),
		);
		expect(readContent(root).posts).toHaveLength(2);
	});

	it('slugs each part of the path into the id, as the glob loader does', () => {
		const root = content({ 'blog/My Series/Hello World.md': post('') });
		expect(readContent(root).posts[0]?.id).toBe('my-series/hello-world');
	});

	it('takes the id from `slug` when the frontmatter sets one', () => {
		const root = content({ 'blog/s/a.md': post('slug: elsewhere/b\n') });
		expect(readContent(root).posts[0]?.id).toBe('elsewhere/b');
	});

	it('applies the defaults and coercions of the collection schema', () => {
		const root = content({ 'blog/a.md': post('seriesOrder: 3\n', 'Body.\n') });
		expect(readContent(root).posts[0]).toMatchObject({
			title: 'T',
			description: 'D',
			draft: false,
			seriesOrder: 3,
			pubDate: Date.UTC(2026, 0, 2),
			body: expect.stringContaining('Body.'),
		});
	});

	it('names the file whose frontmatter does not fit the schema', () => {
		const root = content({ 'blog/a.md': '---\ntitle: T\n---\n' });
		expect(() => readContent(root)).toThrow(join(root, 'blog', 'a.md'));
	});

	it('reads the series by key', () => {
		const root = content({ 'series.json': '{"s":{"name":"Sea","tone":"indigo"}}', 'blog/s/a.md': post('') });
		expect(readContent(root).series).toEqual({ s: { name: 'Sea', tone: 'indigo' } });
	});
});
