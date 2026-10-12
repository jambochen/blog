import type { Root } from 'mdast';
import { readContent } from './contentOnDisk.ts';
import { routesFor } from './routes.ts';
import { linkWikilinks, wikilinkSite } from './wikilinks.ts';

export function remarkWikilinks({ base = '' }: { base?: string } = {}) {
	const routes = routesFor(base);
	return (tree: Root, file: { path?: string }) => {
		try {
			// The plugin runs outside Vite, where `import.meta.env.DEV` does not exist.
			const showDrafts = process.env.NODE_ENV !== 'production';
			linkWikilinks(tree, file.path, wikilinkSite(readContent(), routes, showDrafts));
		} catch (error) {
			throw new Error(`${file.path}: ${error instanceof Error ? error.message : error}`);
		}
	};
}
