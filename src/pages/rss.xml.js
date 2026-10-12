import rss from '@astrojs/rss';
import { SITE_DESCRIPTION, SITE_TITLE } from '../consts';
import { getCatalogue } from '../lib/siteCatalogue';
import { routes } from '../lib/siteRoutes';

export async function GET(context) {
	const { posts } = await getCatalogue();
	return rss({
		title: SITE_TITLE,
		description: SITE_DESCRIPTION,
		site: new URL(routes.home, context.site),
		items: posts.map(({ id, post }) => ({
			...post.data,
			link: routes.post(id),
		})),
	});
}
