import type { APIRoute } from 'astro';
import { parseDbDate } from '../lib/format';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export const GET: APIRoute = async ({ locals, site }) => {
  const db = locals.runtime.env.DB;
  const origin = (site ?? new URL('https://communitylovable.bg')).origin;

  const posts = (
    await db
      .prepare(
        `SELECT p.title, p.slug, p.excerpt, p.created_at, u.name AS author
         FROM posts p JOIN users u ON u.id = p.user_id
         WHERE p.hidden = 0 ORDER BY p.created_at DESC LIMIT 30`
      )
      .all<{ title: string; slug: string; excerpt: string; created_at: string; author: string }>()
  ).results;

  const items = posts
    .map(
      (p) => `<item>
<title>${esc(p.title)}</title>
<link>${origin}/t/${p.slug}</link>
<guid>${origin}/t/${p.slug}</guid>
<description>${esc(p.excerpt)}</description>
<author>${esc(p.author)}</author>
<pubDate>${parseDbDate(p.created_at).toUTCString()}</pubDate>
</item>`
    )
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
<title>Българска Lovable Общност</title>
<link>${origin}/</link>
<description>Мястото на българските Lovable билдъри — дискусии, събития, новини и обучение.</description>
<language>bg</language>
${items}
</channel>
</rss>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=600',
    },
  });
};
