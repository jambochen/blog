import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
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
			// Posts sharing a series name are numbered within it; posts without one are standalone.
			series: z.string().optional(),
			seriesOrder: z.number().optional(),
			// Drafts render in `astro dev` only.
			draft: z.boolean().default(false),
		}),
});

export const collections = { blog };
