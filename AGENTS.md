## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)

## Linking between posts

Link to another post or to a section with a wikilink, never with a hand-written URL. `src/lib/remarkWikilinks.ts` resolves the names and fails the build when one matches nothing.

- `[[版本控制]]` links to the post with that `title` and shows the title as it is.
- `[[#提交改動]]` links to a heading of the same post and shows 「提交改動」.
- `[[版本控制#提交改動]]` links to a heading of another post.
- `[[#提交改動|顯示文字]]` shows the text after `|` as written, without added brackets. Inside a table, write the bar as `\|`.

Write the heading without backticks. A link to a draft is plain text in a build.
