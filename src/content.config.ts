import { defineCollection } from 'astro:content';
import { file, glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { postFields, seriesSchema } from './lib/contentSchema.ts';

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
	schema: ({ image }) => z.object({ ...postFields, heroImage: z.optional(image()) }),
});

const series = defineCollection({
	loader: file('./src/content/series.json'),
	schema: seriesSchema,
});

export const collections = { blog, series };
