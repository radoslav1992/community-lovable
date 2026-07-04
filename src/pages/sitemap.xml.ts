import type { APIRoute } from 'astro';
import { parseDbDate } from '../lib/format';

export const GET: APIRoute = async ({ locals, site }) => {
  const db = locals.runtime.env.DB;
  const origin = (site ?? new URL('https://communitylovable.bg')).origin;

  const [posts] = await db.batch([
    db.prepare('SELECT slug, created_at FROM posts WHERE hidden = 0 ORDER BY created_at DESC LIMIT 5000'),
  ]);

  const staticPages = ['/', '/sabitiya', '/novini', '/obuchenie'];
  const urls: string[] = staticPages.map(
    (p) => `<url><loc>${origin}${p}</loc><changefreq>hourly</changefreq><priority>${p === '/' ? '1.0' : '0.8'}</priority></url>`
  );
  for (const row of posts.results as { slug: string; created_at: string }[]) {
    urls.push(
      `<url><loc>${origin}/t/${row.slug}</loc><lastmod>${parseDbDate(row.created_at).toISOString()}</lastmod><priority>0.7</priority></url>`
    );
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join('')}</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=3600',
    },
  });
};
