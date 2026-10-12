import { routesFor } from './routes.ts';

// The site is served from a subpath on GitHub Pages, and Astro does not put
// `base` in front of links written by hand.
export const routes = routesFor(import.meta.env.BASE_URL);
