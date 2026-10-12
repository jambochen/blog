// Every list of posts the site shows is derived here, from records an adapter
// hands over. Imports nothing from Astro, so it also loads in the Markdown
// plugin and the tests, where `astro:content` does not exist.
import type { SeriesDetails } from './contentSchema.ts';
import { isVisible, type Placement, type PostRecord, placeEpisodes } from './series.ts';

// `P` is whatever the adapter knows a post as; it is carried through untouched.
export interface Source<P> extends PostRecord {
	post: P;
}

export interface SeriesRef extends SeriesDetails {
	key: string;
}

export interface Entry<P> {
	id: string;
	post: P;
	// Both absent for a standalone post.
	series?: SeriesRef;
	placement?: Placement;
}

export interface Series<P> extends SeriesRef {
	// In reading order.
	episodes: Entry<P>[];
}

export interface Turn<P> {
	previous?: Entry<P>;
	next?: Entry<P>;
	// Unpublished episodes after the last one a reader can open; zero while there is a next.
	stillToCome: number;
	continues: boolean;
}

export interface Catalogue<P> {
	// Newest first.
	posts: Entry<P>[];
	// The series written in most recently leads.
	series: Series<P>[];
	// Newest first.
	standalone: Entry<P>[];
	// Hidden from readers, yet a wikilink may still name one.
	drafts: P[];
	// An episode turns to its own series; a standalone post to the standalone posts around its date.
	neighbours(id: string): Turn<P>;
}

export function catalogue<P>(
	sources: Source<P>[],
	registry: Record<string, SeriesDetails>,
	showDrafts: boolean,
): Catalogue<P> {
	const placements = placeEpisodes(sources, showDrafts);
	const refs = new Map<string, SeriesRef>();
	const refOf = (key: string): SeriesRef => {
		// A folder missing from the registry is reported by `seriesProblems`; here it
		// is shown by its key, so that one mistake does not hide the others.
		const details: SeriesDetails = registry[key] ?? { name: key, tone: 'page' };
		const ref = refs.get(key) ?? { ...details, key };
		refs.set(key, ref);
		return ref;
	};

	const posts = sources
		.filter((source) => isVisible(source, showDrafts))
		// Posts of one date keep the same order however the adapter read them.
		.sort((a, b) => b.pubDate - a.pubDate || (a.id < b.id ? 1 : -1))
		.map(({ id, post }): Entry<P> => {
			const placement = placements.get(id);
			return { id, post, placement, series: placement && refOf(placement.key) };
		});

	const groups = new Map<string, Series<P>>();
	for (const entry of posts) {
		if (!entry.series) continue;
		const group = groups.get(entry.series.key) ?? { ...entry.series, episodes: [] };
		group.episodes.push(entry);
		groups.set(group.key, group);
	}
	for (const group of groups.values()) {
		// The `!` is safe: only entries with a series were pushed, and those have a placement.
		group.episodes.sort((a, b) => a.placement!.number - b.placement!.number);
	}
	const standalone = posts.filter((entry) => !entry.series);

	return {
		posts,
		series: [...groups.values()],
		standalone,
		drafts: sources.filter((source) => !isVisible(source, showDrafts)).map(({ post }) => post),
		neighbours(id) {
			const entry = posts.find((candidate) => candidate.id === id);
			const pool = entry?.series
				? (groups.get(entry.series.key)?.episodes ?? [])
				: [...standalone].reverse();
			const index = pool.findIndex((candidate) => candidate.id === id);
			const previous = pool[index - 1];
			const next = pool[index + 1];
			const stillToCome = next ? 0 : (entry?.placement?.unpublishedAfter ?? 0);
			return {
				previous,
				next,
				stillToCome,
				continues: Boolean(entry?.series) && (Boolean(next) || stillToCome > 0),
			};
		},
	};
}

export function episodeLabel(number: number): string {
	return `第 ${number} 篇`;
}

export function placementLabel({ number, total }: Placement): string {
	return `${episodeLabel(number)}，共 ${total} 篇`;
}
