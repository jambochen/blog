import { type CollectionEntry, getCollection } from 'astro:content';
import { type Catalogue, catalogue, type Entry, type Series } from './catalogue.ts';
import { readContent } from './contentOnDisk.ts';

type Post = CollectionEntry<'blog'>;

export type SiteEntry = Entry<Post>;
export type SiteSeries = Series<Post>;

// A wikilink's address is built from the id read from disk, and the page it
// should open is built from Astro's id. Checked here and not with the other
// rules in `contentProblems.ts`, which run before Astro has loaded its collection.
function idDisagreements(astroIds: string[]): string[] {
	const diskIds = readContent().posts.map(({ id }) => id);
	return [
		...astroIds.filter((id) => !diskIds.includes(id)).map((id) => `"${id}" is a post id only in Astro's collection`),
		...diskIds.filter((id) => !astroIds.includes(id)).map((id) => `"${id}" is a post id only in src/lib/contentOnDisk.ts`),
	];
}

async function build(): Promise<Catalogue<Post>> {
	const posts = await getCollection('blog');
	const registry = Object.fromEntries(
		(await getCollection('series')).map((entry) => [entry.id, entry.data] as const),
	);

	const problems = idDisagreements(posts.map(({ id }) => id));
	if (problems.length) throw new Error(problems.join('\n'));

	return catalogue(
		posts.map((post) => ({
			id: post.id,
			draft: post.data.draft,
			seriesOrder: post.data.seriesOrder,
			pubDate: post.data.pubDate.valueOf(),
			post,
		})),
		registry,
		import.meta.env.DEV,
	);
}

let built: Promise<Catalogue<Post>> | undefined;

export function getCatalogue(): Promise<Catalogue<Post>> {
	// Every page of a build asks for the same catalogue; in `astro dev` the posts change under it.
	if (import.meta.env.DEV) return build();
	built ??= build();
	return built;
}
