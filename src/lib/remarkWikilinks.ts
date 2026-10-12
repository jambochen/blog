import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseFrontmatter } from '@astrojs/markdown-remark';
import { slug as slugify } from 'github-slugger';
import type { Root } from 'mdast';
import { routesFor } from './routes.ts';
import { linkWikilinks, type PostSource } from './wikilinks.ts';

const CONTENT_DIR = resolve('src/content/blog');
const SERIES_FILE = resolve('src/content/series.json');

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

// Read on every call rather than once: in `astro dev` a renamed title or
// heading has to reach the posts that refer to it without a restart.
function readPosts(base: string): PostSource[] {
	const routes = routesFor(base);
	const posts: PostSource[] = [];
	for (const entry of readdirSync(CONTENT_DIR, { recursive: true, encoding: 'utf8' })) {
		const extension = /\.mdx?$/.exec(entry)?.[0];
		if (!extension) continue;
		const path = join(CONTENT_DIR, entry);
		const { frontmatter, content } = parseFrontmatter(readFileSync(path, 'utf8'));
		const segments = entry
			.slice(0, -extension.length)
			.split(/[\\/]/)
			.map((segment) => slugify(segment));
		const id = frontmatter.slug ?? segments.join('/');
		posts.push({
			id,
			path,
			title: String(frontmatter.title),
			description: String(frontmatter.description ?? ''),
			url: routes.post(id),
			draft: frontmatter.draft === true,
			seriesOrder: frontmatter.seriesOrder,
			pubDate: new Date(frontmatter.pubDate).valueOf(),
			body: content,
			extension,
		});
	}
	return posts;
}

function readSeriesNames(): Record<string, string> {
	const series: Record<string, { name: string }> = JSON.parse(readFileSync(SERIES_FILE, 'utf8'));
	return Object.fromEntries(Object.entries(series).map(([key, { name }]) => [key, name]));
}

export function remarkWikilinks({ base = '' }: { base?: string } = {}) {
	return (tree: Root, file: { path?: string }) => {
		try {
			linkWikilinks(tree, file.path, {
				posts: readPosts(base),
				// The plugin runs outside Vite, where `import.meta.env.DEV` does not exist.
				showDrafts: process.env.NODE_ENV !== 'production',
				seriesNames: readSeriesNames(),
			});
		} catch (error) {
			const message = `${file.path}: ${error instanceof Error ? error.message : error}`;
			failures.push(message);
			throw new Error(message);
		}
	};
}
