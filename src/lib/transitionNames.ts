// A view transition moves an element from one page to the next when both pages
// give it the same `view-transition-name`, so the name of a post or a series is
// built here once. A name that occurs twice on a page cancels the whole
// transition: give each name to one element per page.

// A post id carries the `/` of its series folder, which a CSS identifier cannot hold.
const identifier = (text: string) => text.replace(/[^\p{L}\p{N}_-]/gu, '-');

export const transitionNames = {
	post: (id: string) => `post-${identifier(id)}`,
	series: (key: string) => `series-${identifier(key)}`,
};
