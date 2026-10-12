// Imports nothing and reads no globals: the pages load this through Vite and the
// wikilink plugin loads it from the Astro config, outside Vite, and a number
// beside a link has to be the one on the page it opens.

export interface PostRecord {
	id: string;
	draft: boolean;
	seriesOrder?: number;
	// Milliseconds since the epoch.
	pubDate: number;
}

export interface Placement {
	series: string;
	number: number;
	total: number;
	// A count only, so the titles of unpublished episodes stay out of the build.
	unpublishedAfter: number;
}

// A post in a folder of `src/content/blog/` belongs to the series that folder
// is named after; a post directly in it is standalone. The folder is already
// the first part of the post's URL, so the series page sits one level above.
export function seriesOf(id: string): string | undefined {
	const [folder, ...rest] = id.split('/');
	return rest.length > 0 ? folder : undefined;
}

// Drafts are left out of a build but kept in `astro dev`, so they can be proofread in place.
export function isVisible(post: Pick<PostRecord, 'draft'>, showDrafts: boolean): boolean {
	return showDrafts || !post.draft;
}

type Ordered = Pick<PostRecord, 'seriesOrder' | 'pubDate'>;

// Posts with an explicit `seriesOrder` come first, in that order; the rest follow by date.
function bySeriesOrder(a: Ordered, b: Ordered): number {
	if (a.seriesOrder !== undefined && b.seriesOrder !== undefined) return a.seriesOrder - b.seriesOrder;
	if (a.seriesOrder !== undefined) return -1;
	if (b.seriesOrder !== undefined) return 1;
	return a.pubDate - b.pubDate;
}

// Keyed by post id. Standalone posts and hidden drafts have no entry; hidden
// drafts are still counted in the `unpublishedAfter` of the episodes before them.
export function placeEpisodes(posts: PostRecord[], showDrafts: boolean): Map<string, Placement> {
	const members = new Map<string, PostRecord[]>();
	for (const post of posts) {
		const series = seriesOf(post.id);
		if (series) members.set(series, [...(members.get(series) ?? []), post]);
	}

	const placements = new Map<string, Placement>();
	for (const [series, all] of members) {
		const hidden = all.filter((post) => !isVisible(post, showDrafts));
		const visible = all
			.filter((post) => isVisible(post, showDrafts))
			// Two episodes given the same `seriesOrder` fall back to their dates,
			// so the numbers do not depend on the order the posts were read in.
			.sort((a, b) => bySeriesOrder(a, b) || a.pubDate - b.pubDate);
		visible.forEach((post, index) => {
			placements.set(post.id, {
				series,
				number: index + 1,
				total: visible.length,
				unpublishedAfter: hidden.filter((draft) => bySeriesOrder(draft, post) > 0).length,
			});
		});
	}
	return placements;
}

// One line a problem, each naming the file to fix. Series pages and standalone
// posts are served at `/<name>/`, so `reserved` maps every name already taken
// at the site's root to what holds it.
export function seriesProblems(
	posts: { id: string; path?: string }[],
	registered: string[],
	reserved: Map<string, string>,
): string[] {
	const problems: string[] = [];
	const folders = new Set<string>();
	for (const { id, path = id } of posts) {
		const folder = seriesOf(id);
		const [name] = id.split('/');
		if (folder) {
			// A folder's mistake is reported at its first post rather than at every one.
			if (folders.has(folder)) continue;
			folders.add(folder);
			if (!registered.includes(folder)) {
				problems.push(`${path}: folder "${folder}" is not in src/content/series.json`);
			}
		} else if (registered.includes(id)) {
			problems.push(`${path}: a standalone post cannot share the name of series "${id}"`);
		}
		if (reserved.has(name)) problems.push(`${path}: "${name}" is already ${reserved.get(name)}`);
	}
	for (const series of registered) {
		if (!folders.has(series)) {
			problems.push(`src/content/series.json: "${series}" has no folder of posts in src/content/blog`);
		}
	}
	return problems;
}
