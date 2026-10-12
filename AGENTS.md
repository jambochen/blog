## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

After a change to the layout, or a new figure, table or code block, open the page at a width of 375px. Nothing may make the page scroll sideways, and text must keep enough contrast in light and dark.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)

## Writing posts

Before writing or changing the text or a heading of a post, read `docs/style.md`. The terms for the text are in the section 「文章用語」 of `GLOSSARY.md`. Run `scripts/check-wording.sh` after a change to a post in `coding-agent/`; it lists each word to replace.

Show a rewrite of post text to Jambo before writing it into the post.

## Linking between posts

Link to another post or to a section with a wikilink, never with a hand-written URL. `src/lib/wikilinks.ts` resolves the names, and a build stops before rendering when one matches nothing.

- `[[版本控制]]` links to the post with that `title` and shows the title as it is.
- `[[#提交改動]]` links to a heading of the same post and shows 「提交改動」.
- `[[版本控制#提交改動]]` links to a heading of another post.
- `[[#提交改動|顯示文字]]` shows the text after `|` as written, without added brackets. Inside a table, write the bar as `\|`.

Write the heading without backticks. A link to a draft is plain text in a build.

## Series

A series is a folder in `src/content/blog/`: every post in `blog/<key>/` belongs to it and `/blog/<key>/` is its page. A post directly in `blog/` is standalone. Do not add a `series` field to frontmatter; set only `seriesOrder` for the post's place.

Each folder needs an entry under the same key in `src/content/series.json`, with the name, an optional description and the tone of its colour block. The series rules and the wikilinks are checked by `src/lib/contentProblems.ts`, which lists the problems together, with the first broken wikilink of each file. `astro dev` logs them as warnings when it starts, and a post with a broken wikilink still fails when it is opened. Invalid frontmatter is reported one file at a time. The build fails when a folder has no entry, an entry has no folder, a standalone post is named like a series, or a series or standalone post is named like a page in `src/pages/`.
