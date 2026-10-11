import { type CollectionEntry, getCollection } from 'astro:content';

type Post = CollectionEntry<'blog'>;

// Reused from the start once there are more series than tones.
const TONES = ['page', 'indigo', 'vermilion', 'moss'] as const;
export type Tone = (typeof TONES)[number];

export interface SeriesPosition {
	name: string;
	slug: string;
	tone: Tone;
	number: number;
	total: number;
}

export interface Episode {
	post: Post;
	// Absent for standalone posts.
	series?: SeriesPosition;
}

export interface Series {
	name: string;
	slug: string;
	tone: Tone;
	episodes: Episode[];
}

export function seriesSlug(name: string): string {
	return name.trim().toLowerCase().replace(/\s+/g, '-');
}

const byPubDate = (a: Post, b: Post) => a.data.pubDate.valueOf() - b.data.pubDate.valueOf();

// Posts with an explicit `seriesOrder` come first, in that order; the rest follow by date.
function bySeriesOrder(a: Post, b: Post): number {
	const orderA = a.data.seriesOrder;
	const orderB = b.data.seriesOrder;
	if (orderA !== undefined && orderB !== undefined) return orderA - orderB;
	if (orderA !== undefined) return -1;
	if (orderB !== undefined) return 1;
	return byPubDate(a, b);
}

// Drafts are left out of a build but kept in `astro dev`, so they can be proofread in place.
export function getPosts(): Promise<Post[]> {
	return getCollection('blog', ({ data }) => import.meta.env.DEV || !data.draft);
}

// Oldest first.
export async function getEpisodes(): Promise<Episode[]> {
	const posts = (await getPosts()).sort(byPubDate);

	const members = new Map<string, Post[]>();
	for (const post of posts) {
		const name = post.data.series;
		if (name) members.set(name, [...(members.get(name) ?? []), post]);
	}

	const positions = new Map<string, SeriesPosition>();
	// `members` lists series by their oldest post, so a series keeps its tone when a newer series is added.
	[...members].forEach(([name, seriesPosts], seriesIndex) => {
		// The `!` is safe: the index is taken modulo the array's own length.
		const tone = TONES[seriesIndex % TONES.length]!;
		seriesPosts.sort(bySeriesOrder).forEach((post, index) => {
			positions.set(post.id, {
				name,
				slug: seriesSlug(name),
				tone,
				number: index + 1,
				total: seriesPosts.length,
			});
		});
	});

	return posts.map((post) => ({ post, series: positions.get(post.id) }));
}

export function groupSeries(episodes: Episode[]): Series[] {
	const groups = new Map<string, Series>();
	for (const episode of episodes) {
		if (!episode.series) continue;
		const { name, slug, tone } = episode.series;
		const group = groups.get(slug) ?? { name, slug, tone, episodes: [] };
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

// Chinese is counted by character and Latin text by word; code blocks, imports and markup are left out.
export function countWords(body: string): number {
	const prose = body
		.replace(/```[\s\S]*?```/g, '')
		.replace(/^import .*$/gm, '')
		.replace(/<[^>]+>/g, '');
	const cjk = prose.match(/[\u4e00-\u9fff]/g)?.length ?? 0;
	const latin = prose.match(/[A-Za-z0-9]+/g)?.length ?? 0;
	return cjk + latin;
}
