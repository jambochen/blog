import { defineCollection } from 'astro:content';
import { file, glob } from 'astro/loaders';
import { z } from 'astro/zod';

// Load Markdown and MDX files in the `src/content/blog/` directory.
const posts = glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' });

const blog = defineCollection({
	loader: {
		...posts,
		// The loader keeps a Markdown post's HTML until that file changes, but a
		// `[[wikilink]]` in it depends on other posts too: the target may have been
		// published, renamed or removed since. Emptying the store renders every post anew.
		load: (context) => {
			context.store.clear();
			return posts.load(context);
		},
	},
	// Type-check frontmatter using a schema
	schema: ({ image }) =>
		z.object({
			title: z.string(),
			description: z.string(),
			// Transform string to Date object
			pubDate: z.coerce.date(),
			updatedDate: z.coerce.date().optional(),
			heroImage: z.optional(image()),
			tags: z.array(z.string()).default([]),
			// Place within the series, which is the folder the post is in; see `seriesOf`.
			seriesOrder: z.number().optional(),
			// Drafts render in `astro dev` only.
			draft: z.boolean().default(false),
		}),
});

const series = defineCollection({
	loader: file('./src/content/series.json'),
	schema: z.object({
		name: z.string(),
		description: z.string().optional(),
		// Each names a `[data-tone]` rule in `global.css`; `page` leaves the colour block unfilled.
		tone: z.enum(['page', 'indigo', 'vermilion', 'moss']),
	}),
});

export const collections = { blog, series };
