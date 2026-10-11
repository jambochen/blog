// The site is served from a subpath on GitHub Pages, and Astro does not put
// `base` in front of links written by hand.
const base = import.meta.env.BASE_URL.replace(/\/$/, '');

export function withBase(path: string): string {
	return `${base}${path}`;
}
