import type { APIRoute } from 'astro';
import { SITE_DESCRIPTION, SITE_TITLE } from '../consts';
import { shareCard } from '../lib/shareCard';

export const GET: APIRoute = () => shareCard({ title: SITE_DESCRIPTION, siteName: SITE_TITLE });
