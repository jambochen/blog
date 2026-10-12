import { describe, expect, it } from 'vitest';
import { isVisible, type PostRecord, placeEpisodes, seriesOf, seriesProblems } from './series.ts';

const day = (n: number) => Date.UTC(2026, 0, n);

function post(id: string, pubDate: number, rest: Partial<PostRecord> = {}): PostRecord {
	return { id, pubDate, draft: false, ...rest };
}

function numbers(posts: PostRecord[], showDrafts = false): Record<string, number> {
	return Object.fromEntries([...placeEpisodes(posts, showDrafts)].map(([id, { number }]) => [id, number]));
}

describe('seriesOf', () => {
	it('gives a standalone post no series', () => {
		expect(seriesOf('hello')).toBeUndefined();
	});

	it('names the series after the folder', () => {
		expect(seriesOf('agent/hello')).toBe('agent');
	});

	it('takes the outermost folder of a nested post', () => {
		expect(seriesOf('agent/part-one/hello')).toBe('agent');
	});
});

describe('isVisible', () => {
	it('hides a draft unless drafts are shown', () => {
		expect(isVisible({ draft: true }, false)).toBe(false);
		expect(isVisible({ draft: true }, true)).toBe(true);
	});

	it('always shows a published post', () => {
		expect(isVisible({ draft: false }, false)).toBe(true);
		expect(isVisible({ draft: false }, true)).toBe(true);
	});
});

describe('placeEpisodes', () => {
	it('leaves standalone posts out', () => {
		expect(placeEpisodes([post('hello', day(1))], false).size).toBe(0);
	});

	it('orders by seriesOrder when every episode has one', () => {
		const posts = [
			post('s/a', day(1), { seriesOrder: 3 }),
			post('s/b', day(2), { seriesOrder: 1 }),
			post('s/c', day(3), { seriesOrder: 2 }),
		];
		expect(numbers(posts)).toEqual({ 's/b': 1, 's/c': 2, 's/a': 3 });
	});

	it('orders by date when no episode has a seriesOrder', () => {
		const posts = [post('s/a', day(3)), post('s/b', day(1)), post('s/c', day(2))];
		expect(numbers(posts)).toEqual({ 's/b': 1, 's/c': 2, 's/a': 3 });
	});

	it('puts episodes with a seriesOrder before those without, which follow by date', () => {
		const posts = [
			post('s/a', day(1)),
			post('s/b', day(4), { seriesOrder: 2 }),
			post('s/c', day(2)),
			post('s/d', day(3), { seriesOrder: 1 }),
		];
		expect(numbers(posts)).toEqual({ 's/d': 1, 's/b': 2, 's/a': 3, 's/c': 4 });
	});

	it('breaks a shared seriesOrder by date, whatever order the posts arrive in', () => {
		const early = post('s/early', day(1), { seriesOrder: 1 });
		const late = post('s/late', day(2), { seriesOrder: 1 });
		expect(numbers([early, late])).toEqual({ 's/early': 1, 's/late': 2 });
		expect(numbers([late, early])).toEqual({ 's/early': 1, 's/late': 2 });
	});

	it('numbers each series on its own and reports its total', () => {
		const placements = placeEpisodes(
			[post('s/a', day(1)), post('t/a', day(2)), post('s/b', day(3)), post('hello', day(4))],
			false,
		);
		expect(placements.get('s/a')).toMatchObject({ key: 's', number: 1, total: 2 });
		expect(placements.get('s/b')).toMatchObject({ key: 's', number: 2, total: 2 });
		expect(placements.get('t/a')).toMatchObject({ key: 't', number: 1, total: 1 });
	});

	describe('with a draft in the middle of a series', () => {
		const posts = [
			post('s/a', day(1), { seriesOrder: 1 }),
			post('s/b', day(2), { seriesOrder: 2, draft: true }),
			post('s/c', day(3), { seriesOrder: 3 }),
		];

		it('skips the hidden draft when numbering', () => {
			const placements = placeEpisodes(posts, false);
			expect(placements.has('s/b')).toBe(false);
			expect(placements.get('s/a')).toMatchObject({ number: 1, total: 2 });
			expect(placements.get('s/c')).toMatchObject({ number: 2, total: 2 });
		});

		it('keeps a slot for the hidden draft where it will appear', () => {
			const placements = placeEpisodes(posts, false);
			expect(placements.get('s/a')).toMatchObject({ slot: 1, unpublished: [2] });
			expect(placements.get('s/c')).toMatchObject({ slot: 3, unpublished: [2] });
		});

		it('numbers the draft with the rest when drafts are shown', () => {
			const placements = placeEpisodes(posts, true);
			expect(placements.get('s/a')).toMatchObject({ number: 1, total: 3 });
			expect(placements.get('s/b')).toMatchObject({ number: 2, total: 3 });
			expect(placements.get('s/c')).toMatchObject({ number: 3, total: 3 });
		});
	});

	describe('unpublishedAfter', () => {
		const posts = [
			post('s/a', day(1), { seriesOrder: 1 }),
			post('s/b', day(2), { seriesOrder: 2, draft: true }),
			post('s/c', day(3), { seriesOrder: 3 }),
			post('s/d', day(4), { seriesOrder: 4, draft: true }),
			post('t/a', day(5)),
			post('t/b', day(6), { draft: true }),
		];

		it('counts the hidden drafts later in the same series', () => {
			const placements = placeEpisodes(posts, false);
			expect(placements.get('s/a')?.unpublishedAfter).toBe(2);
			expect(placements.get('s/c')?.unpublishedAfter).toBe(1);
			expect(placements.get('t/a')?.unpublishedAfter).toBe(1);
		});

		it('is zero when drafts are shown, as nothing is unpublished then', () => {
			const placements = placeEpisodes(posts, true);
			for (const { unpublishedAfter } of placements.values()) expect(unpublishedAfter).toBe(0);
		});

		it('counts a draft without a seriesOrder as after every ordered episode', () => {
			const placements = placeEpisodes(
				[post('s/a', day(9), { seriesOrder: 1 }), post('s/b', day(1), { draft: true })],
				false,
			);
			expect(placements.get('s/a')?.unpublishedAfter).toBe(1);
		});
	});
});

describe('seriesProblems', () => {
	const reserved = new Map([['about', 'the page src/pages/about']]);
	const problems = (ids: string[], registered: string[] = []) =>
		seriesProblems(
			ids.map((id) => ({ id })),
			registered,
			reserved,
		);

	it('finds none when every folder is registered and every entry has a folder', () => {
		expect(problems(['s/a', 's/b', 'alone'], ['s'])).toEqual([]);
	});

	it('names a folder that has no entry, once for the folder', () => {
		expect(problems(['s/a', 's/b'])).toEqual(['s/a: folder "s" is not in src/content/series.json']);
	});

	it('names an entry that has no folder', () => {
		expect(problems(['alone'], ['s'])).toEqual([
			'src/content/series.json: "s" has no folder of posts in src/content/blog',
		]);
	});

	it('names a standalone post called like a series', () => {
		expect(problems(['s/a', 's'], ['s'])).toEqual(['s: a standalone post cannot share the name of series "s"']);
	});

	it('names a standalone post or a series that takes a reserved name', () => {
		expect(problems(['about'])).toEqual(['about: "about" is already the page src/pages/about']);
		expect(problems(['about/a'], ['about'])).toEqual(['about/a: "about" is already the page src/pages/about']);
	});

	it('names the file when the post has a path', () => {
		expect(seriesProblems([{ id: 's/a', path: 'src/content/blog/s/a.md' }], [], reserved)).toEqual([
			'src/content/blog/s/a.md: folder "s" is not in src/content/series.json',
		]);
	});

	it('reports every problem rather than the first', () => {
		expect(problems(['s/a', 'about'], ['t'])).toHaveLength(3);
	});
});
