// Astro's collections and the wikilink plugin both read the posts, the plugin
// from disk because it runs outside Astro's content layer. Both validate with
// these, so a default or a coercion cannot differ between a page and a link to it.
import { z } from 'astro/zod';

export const postFields = {
	title: z.string(),
	description: z.string(),
	pubDate: z.coerce.date(),
	updatedDate: z.coerce.date().optional(),
	tags: z.array(z.string()).default([]),
	// Place within the series, which is the folder the post is in; see `seriesOf`.
	seriesOrder: z.number().optional(),
	// Drafts render in `astro dev` only.
	draft: z.boolean().default(false),
};

export const seriesSchema = z.object({
	name: z.string(),
	description: z.string().optional(),
	// Each names a `[data-tone]` rule in `global.css`; `page` leaves the colour block unfilled.
	tone: z.enum(['page', 'indigo', 'vermilion', 'moss']),
});

export type SeriesDetails = z.infer<typeof seriesSchema>;
export type Tone = SeriesDetails['tone'];
