import type { Content } from './contentOnDisk.ts';
import { routesFor } from './routes.ts';
import { seriesProblems } from './series.ts';
import { wikilinkProblems, wikilinkSite } from './wikilinks.ts';

// Every rule the content has to keep, in one list, so an author sees all the
// mistakes of an edit at once. One line a problem, each naming the file to fix.
export function contentProblems(content: Content, showDrafts: boolean): string[] {
	return [
		...seriesProblems(content.posts, Object.keys(content.series), content.reserved),
		// The addresses do not matter to whether a wikilink resolves.
		...wikilinkProblems(wikilinkSite(content, routesFor(''), showDrafts)),
	];
}
