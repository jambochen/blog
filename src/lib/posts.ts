import { type CollectionEntry, getCollection } from 'astro:content';
import { isVisible, placeEpisodes, seriesProblems } from './series.ts';

type Post = CollectionEntry<'blog'>;

export type Tone = CollectionEntry<'series'>['data']['tone'];

export interface SeriesPosition {
	name: string;
	slug: string;
	description?: string;
	tone: Tone;
	number: number;
	total: number;
	// A count only, so the titles of unpublished episodes stay out of the build.
	unpublishedAfter: number;
}

export interface Episode {
	post: Post;
	// Absent for standalone posts.
	series?: SeriesPosition;
}

export interface Series {
	name: string;
	slug: string;
	description?: string;
	tone: Tone;
	episodes: Episode[];
}

// Series and standalone posts are served from the site's root, beside these
// pages and the folders a build writes there.
const RESERVED = new Map([
	...Object.keys(import.meta.glob('../pages/*')).map((path) => {
		const name = path.replace('../pages/', '').replace(/\.[^.]+$/, '');
		return [name, `the page src/pages/${name}`] as const;
	}),
	['_astro', 'the folder a build writes its assets to'],
	['pagefind', 'the folder a build writes the search index to'],
]);

const byPubDate = (a: Post, b: Post) => a.data.pubDate.valueOf() - b.data.pubDate.valueOf();

export function getPosts(): Promise<Post[]> {
	return getCollection('blog', ({ data }) => isVisible(data, import.meta.env.DEV));
}

// Oldest first.
export async function getEpisodes(): Promise<Episode[]> {
	const everyPost = await getCollection('blog');
	const posts = everyPost.filter(({ data }) => isVisible(data, import.meta.env.DEV)).sort(byPubDate);

	const registry = new Map(
		(await getCollection('series')).map((entry) => [entry.id, entry.data] as const),
	);
	const problems = seriesProblems(
		everyPost.map(({ id, filePath }) => ({ id, path: filePath })),
		[...registry.keys()],
		RESERVED,
	);
	if (problems.length) throw new Error(problems.join('\n'));

	const placements = placeEpisodes(
		everyPost.map(({ id, data }) => ({
			id,
			draft: data.draft,
			seriesOrder: data.seriesOrder,
			pubDate: data.pubDate.valueOf(),
		})),
		import.meta.env.DEV,
	);

	return posts.map((post) => {
		const placement = placements.get(post.id);
		if (!placement) return { post, series: undefined };
		const { series: slug, number, total, unpublishedAfter } = placement;
		// The `!` is safe: a folder missing from the registry is one of the problems thrown above.
		const { name, description, tone } = registry.get(slug)!;
		return { post, series: { name, slug, description, tone, number, total, unpublishedAfter } };
	});
}

export function groupSeries(episodes: Episode[]): Series[] {
	const groups = new Map<string, Series>();
	for (const episode of episodes) {
		if (!episode.series) continue;
		const { name, slug, description, tone } = episode.series;
		const group = groups.get(slug) ?? { name, slug, description, tone, episodes: [] };
		group.episodes.push(episode);
		groups.set(slug, group);
	}
	for (const group of groups.values()) {
		// The `!` is safe: only episodes with `series` set were pushed above.
		group.episodes.sort((a, b) => a.series!.number - b.series!.number);
	}
	return [...groups.values()];
}

// A series episode continues into its own series; a standalone post into the
// next standalone post by date.
export function neighbours(
	episodes: Episode[],
	episode: Episode,
): { previous?: Episode; next?: Episode } {
	const slug = episode.series?.slug;
	const pool = slug
		? (groupSeries(episodes).find((series) => series.slug === slug)?.episodes ?? [])
		: episodes.filter((candidate) => !candidate.series);
	const index = pool.findIndex((candidate) => candidate.post.id === episode.post.id);
	return { previous: pool[index - 1], next: pool[index + 1] };
}

export function seriesPositionLabel(position: SeriesPosition): string {
	return `第 ${position.number} 篇，共 ${position.total} 篇`;
}
