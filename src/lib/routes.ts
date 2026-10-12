// Imports nothing and takes the base as an argument, because the Markdown
// plugins run outside Vite and cannot read `import.meta.env`.
export function routesFor(base: string) {
	// Astro hands the base over with or without a trailing slash, depending on `trailingSlash`.
	const root = base.replace(/\/$/, '');

	return {
		home: `${root}/`,
		posts: `${root}/posts`,
		about: `${root}/about`,
		search: `${root}/search`,
		rss: `${root}/rss.xml`,
		sitemap: `${root}/sitemap-index.xml`,
		faviconSvg: `${root}/favicon.svg`,
		faviconIco: `${root}/favicon.ico`,
		pagefind: `${root}/pagefind/pagefind.js`,

		post: (id: string) => `${root}/${id}/`,
		series: (key: string) => `${root}/${key}/`,

		// Only a whole leading segment is the base: under `/blog`, `/blogger` is another path.
		withoutBase: (path: string) =>
			path === root || path.startsWith(`${root}/`) ? path.slice(root.length) : path,
	};
}

export type Routes = ReturnType<typeof routesFor>;
