import { describe, expect, it } from 'vitest';
import { catalogue, placementLabel, type Source } from './catalogue.ts';

const day = (n: number) => Date.UTC(2026, 0, n);

function source(id: string, pubDate: number, rest: Partial<Source<string>> = {}): Source<string> {
	return { id, pubDate, draft: false, post: id, ...rest };
}

const registry = {
	s: { name: 'Sea', tone: 'indigo' as const },
	t: { name: 'Tea', description: 'About tea.', tone: 'moss' as const },
};

const ids = (entries: { id: string }[]) => entries.map(({ id }) => id);

describe('catalogue', () => {
	const sources = [
		source('s/a', day(1)),
		source('alone', day(2)),
		source('t/a', day(3)),
		source('s/b', day(4)),
		source('later', day(5)),
		source('t/draft', day(6), { draft: true }),
	];
	const built = catalogue(sources, registry, false);

	it('lists the posts a reader can open, newest first', () => {
		expect(ids(built.posts)).toEqual(['later', 's/b', 't/a', 'alone', 's/a']);
	});

	it('lists the same order whatever order the sources arrive in', () => {
		const sameDay = [source('b', day(1)), source('a', day(1)), source('c', day(1))];
		expect(ids(catalogue(sameDay, {}, false).posts)).toEqual(ids(catalogue([...sameDay].reverse(), {}, false).posts));
	});

	it('leads with the series written in most recently', () => {
		expect(built.series.map(({ key }) => key)).toEqual(['s', 't']);
		expect(catalogue([...sources, source('t/b', day(9))], registry, false).series.map(({ key }) => key)).toEqual([
			't',
			's',
		]);
	});

	it('gives a series its details and its episodes in reading order', () => {
		const [sea] = built.series;
		expect(sea).toMatchObject({ key: 's', name: 'Sea', tone: 'indigo' });
		expect(ids(sea?.episodes ?? [])).toEqual(['s/a', 's/b']);
	});

	it('follows seriesOrder over dates within a series', () => {
		const ordered = [source('s/a', day(1), { seriesOrder: 2 }), source('s/b', day(2), { seriesOrder: 1 })];
		expect(ids(catalogue(ordered, registry, false).series[0]?.episodes ?? [])).toEqual(['s/b', 's/a']);
	});

	it('gives an episode its series and its placement, and a standalone post neither', () => {
		const episode = built.posts.find(({ id }) => id === 's/b');
		expect(episode?.series).toMatchObject({ key: 's', name: 'Sea' });
		expect(episode?.placement).toMatchObject({ number: 2, total: 2 });
		const alone = built.posts.find(({ id }) => id === 'alone');
		expect(alone?.series).toBeUndefined();
		expect(alone?.placement).toBeUndefined();
	});

	it('lists standalone posts on their own, newest first', () => {
		expect(ids(built.standalone)).toEqual(['later', 'alone']);
	});

	it('keeps hidden drafts apart from the posts', () => {
		expect(built.drafts).toEqual(['t/draft']);
		expect(catalogue(sources, registry, true).drafts).toEqual([]);
		expect(ids(catalogue(sources, registry, true).posts)).toContain('t/draft');
	});

	it('shows a series missing from the registry by its key', () => {
		const [series] = catalogue([source('u/a', day(1))], {}, false).series;
		expect(series).toMatchObject({ key: 'u', name: 'u', tone: 'page' });
	});
});

describe('neighbours', () => {
	const sources = [
		source('s/a', day(1), { seriesOrder: 1 }),
		source('s/b', day(2), { seriesOrder: 2, draft: true }),
		source('s/c', day(3), { seriesOrder: 3 }),
		source('s/d', day(4), { seriesOrder: 4, draft: true }),
		source('old', day(5)),
		source('new', day(6)),
	];
	const { neighbours } = catalogue(sources, {}, false);

	it('turns an episode to the episodes around it in its series', () => {
		expect(neighbours('s/a').previous).toBeUndefined();
		expect(neighbours('s/a').next?.id).toBe('s/c');
		expect(neighbours('s/c').previous?.id).toBe('s/a');
	});

	it('continues while a next episode can be opened, without counting what is unpublished', () => {
		expect(neighbours('s/a')).toMatchObject({ continues: true, stillToCome: 0 });
	});

	it('continues after the last open episode when unpublished ones follow', () => {
		expect(neighbours('s/c')).toMatchObject({ next: undefined, continues: true, stillToCome: 1 });
	});

	it('ends at the last episode once every episode is shown', () => {
		expect(catalogue(sources, {}, true).neighbours('s/d')).toMatchObject({ continues: false, stillToCome: 0 });
	});

	it('turns a standalone post to the standalone posts around its date, and never continues', () => {
		expect(neighbours('old')).toMatchObject({ previous: undefined, continues: false });
		expect(neighbours('old').next?.id).toBe('new');
		expect(neighbours('new').previous?.id).toBe('old');
	});
});

describe('placementLabel', () => {
	it('states the number and the total', () => {
		const [entry] = catalogue([source('s/a', day(1)), source('s/b', day(2))], {}, false).series[0]?.episodes ?? [];
		// The `!` is safe: every episode of a series has a placement.
		expect(placementLabel(entry!.placement!)).toBe('第 1 篇，共 2 篇');
	});
});
