import type { Root } from 'mdast';
import { catalogue } from './catalogue.ts';
import { readContent } from './contentOnDisk.ts';
import { routesFor } from './routes.ts';
import { linkWikilinks } from './wikilinks.ts';

const failures: string[] = [];

// Astro only logs an error thrown while rendering a `.md` post and builds the
// page empty, where an `.mdx` post stops the build. This stops it for both.
export function wikilinkCheck() {
	return {
		name: 'wikilink-check',
		hooks: {
			'astro:build:done': () => {
				if (failures.length) throw new Error(`Unresolved wikilinks:\n${failures.join('\n')}`);
			},
		},
	};
}

export function remarkWikilinks({ base = '' }: { base?: string } = {}) {
	const routes = routesFor(base);
	return (tree: Root, file: { path?: string }) => {
		try {
			const { posts, series } = readContent();
			linkWikilinks(
				tree,
				file.path,
				catalogue(
					posts.map((post) => ({ ...post, post: { ...post, url: routes.post(post.id) } })),
					series,
					// The plugin runs outside Vite, where `import.meta.env.DEV` does not exist.
					process.env.NODE_ENV !== 'production',
				),
			);
		} catch (error) {
			const message = `${file.path}: ${error instanceof Error ? error.message : error}`;
			failures.push(message);
			throw new Error(message);
		}
	};
}
