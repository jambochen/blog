import type { AstroIntegration } from 'astro';
import { readContent } from './contentOnDisk.ts';
import { contentProblems } from './contentProblems.ts';

// Stops a build before any page is rendered: Astro only logs an error thrown
// while rendering a `.md` post and builds the page empty. In `astro dev` the
// problems are warnings, so a post can be written before the one it links to.
export function contentCheck(): AstroIntegration {
	return {
		name: 'content-check',
		hooks: {
			'astro:build:start': () => {
				const problems = contentProblems(readContent(), false);
				if (problems.length) throw new Error(`Content problems:\n${problems.join('\n')}`);
			},
			'astro:server:setup': ({ logger }) => {
				for (const problem of contentProblems(readContent(), true)) logger.warn(problem);
			},
		},
	};
}
