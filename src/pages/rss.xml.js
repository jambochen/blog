import rss from '@astrojs/rss';
import { SITE_DESCRIPTION, SITE_TITLE } from '../consts';
import { getPosts } from '../lib/posts';
import { routes } from '../lib/siteRoutes';

export async function GET(context) {
	const posts = await getPosts();
	return rss({
		title: SITE_TITLE,
		description: SITE_DESCRIPTION,
		site: new URL(routes.home, context.site),
		items: posts.map((post) => ({
			...post.data,
			link: routes.post(post.id),
		})),
	});
}
