import type { APIRoute, GetStaticPaths } from 'astro';
import { SITE_TITLE } from '../../consts';
import { getCatalogue, type SiteEntry } from '../../lib/siteCatalogue';
import { shareCard } from '../../lib/shareCard';

export const getStaticPaths: GetStaticPaths = async () =>
	(await getCatalogue()).posts.map((entry) => ({ params: { slug: entry.id }, props: { entry } }));

export const GET: APIRoute<{ entry: SiteEntry }> = ({ props: { entry } }) =>
	shareCard({
		title: entry.post.data.title,
		context: entry.series?.name,
		number: entry.placement?.number,
		siteName: SITE_TITLE,
	});
