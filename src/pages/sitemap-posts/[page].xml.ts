import type { APIRoute } from 'astro';
import { parseDbDate } from '../../lib/format';

const POSTS_PER_SITEMAP = 45_000;

function xmlEscape(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

export const GET: APIRoute = async ({ locals, params, site }) => {
  const db = locals.runtime.env.DB;
  const origin = (site ?? new URL('https://communitylovable.bg')).origin;
  const page = Number(params.page);

  if (!Number.isInteger(page) || page < 1) {
    return new Response(null, { status: 404, statusText: 'Not Found' });
  }

  const offset = (page - 1) * POSTS_PER_SITEMAP;
  const posts = (
    await db
      .prepare('SELECT slug, created_at FROM posts WHERE hidden = 0 ORDER BY created_at DESC LIMIT ? OFFSET ?')
      .bind(POSTS_PER_SITEMAP, offset)
      .all<{ slug: string; created_at: string }>()
  ).results;

  if (posts.length === 0 && page > 1) {
    return new Response(null, { status: 404, statusText: 'Not Found' });
  }

  const urls = posts.map(
    (row) => `<url><loc>${xmlEscape(`${origin}/t/${row.slug}`)}</loc><lastmod>${parseDbDate(row.created_at).toISOString()}</lastmod><changefreq>daily</changefreq><priority>0.7</priority></url>`
  );

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join('')}</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=3600',
    },
  });
};
