import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseFrontmatter } from '@astrojs/markdown-remark';
import { z } from 'astro/zod';
import { slug as slugify } from 'github-slugger';
import { postFields, type SeriesDetails, seriesSchema } from './contentSchema.ts';
import type { PostRecord } from './series.ts';

export interface PostFile extends PostRecord {
	path: string;
	title: string;
	description: string;
	// The Markdown under the frontmatter.
	body: string;
	extension: string;
}

export interface Content {
	posts: PostFile[];
	series: Record<string, SeriesDetails>;
}

const frontmatterSchema = z.object({ ...postFields, slug: z.string().optional() });

// Has to give each post the id Astro's glob loader gives it, since the id is the
// post's address: the loader slugs each part of the path, unless the frontmatter
// sets `slug`. `siteCatalogue.ts` stops a build in which the two disagree.
function idOf(entry: string, extension: string, slug: string | undefined): string {
	if (slug) return slug;
	return entry
		.slice(0, -extension.length)
		.split(/[\\/]/)
		.map((segment) => slugify(segment))
		.join('/');
}

// Not cached: in `astro dev` a renamed title or heading has to reach the posts
// that refer to it without a restart.
export function readContent(root = resolve('src/content')): Content {
	const blog = join(root, 'blog');
	const posts: PostFile[] = [];
	for (const entry of readdirSync(blog, { recursive: true, encoding: 'utf8' })) {
		const extension = /\.mdx?$/.exec(entry)?.[0];
		if (!extension) continue;
		const path = join(blog, entry);
		const { frontmatter, content } = parseFrontmatter(readFileSync(path, 'utf8'));
		const parsed = frontmatterSchema.safeParse(frontmatter);
		if (!parsed.success) throw new Error(`${path}: ${z.prettifyError(parsed.error)}`);
		const { title, description, draft, seriesOrder, pubDate, slug } = parsed.data;
		posts.push({
			id: idOf(entry, extension, slug),
			path,
			title,
			description,
			draft,
			seriesOrder,
			pubDate: pubDate.valueOf(),
			body: content,
			extension,
		});
	}
	const series = z
		.record(z.string(), seriesSchema)
		.parse(JSON.parse(readFileSync(join(root, 'series.json'), 'utf8')));
	return { posts, series };
}
