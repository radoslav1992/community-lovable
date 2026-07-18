import type { APIRoute } from 'astro';

const POSTS_PER_SITEMAP = 45_000;

function xmlEscape(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

export const GET: APIRoute = async ({ locals, site }) => {
  const db = locals.runtime.env.DB;
  const origin = (site ?? new URL('https://communitylovable.bg')).origin;

  const [{ total = 0 } = {}] = (
    await db.prepare('SELECT COUNT(*) AS total FROM posts WHERE hidden = 0').all<{ total: number }>()
  ).results;
  const postSitemapCount = Math.ceil(total / POSTS_PER_SITEMAP);

  const sitemaps = [`<sitemap><loc>${xmlEscape(`${origin}/sitemap.xml`)}</loc></sitemap>`];
  for (let page = 1; page <= postSitemapCount; page += 1) {
    sitemaps.push(`<sitemap><loc>${xmlEscape(`${origin}/sitemap-posts/${page}.xml`)}</loc></sitemap>`);
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${sitemaps.join('')}</sitemapindex>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=3600',
    },
  });
};
