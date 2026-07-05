import type { APIRoute } from 'astro';
import { parseDbDate } from '../lib/format';

export const GET: APIRoute = async ({ locals, site }) => {
  const db = locals.runtime.env.DB;
  const origin = (site ?? new URL('https://communitylovable.bg')).origin;

  const [posts, news, courses, lessons, articles, profiles] = await db.batch([
    db.prepare('SELECT slug, created_at FROM posts WHERE hidden = 0 ORDER BY created_at DESC LIMIT 5000'),
    db.prepare('SELECT slug, published_at FROM news ORDER BY published_at DESC LIMIT 500'),
    db.prepare('SELECT slug FROM courses ORDER BY sort'),
    db.prepare(`SELECT c.slug AS course_slug, l.slug AS lesson_slug FROM lessons l JOIN courses c ON c.id = l.course_id ORDER BY c.sort, l.sort`),
    db.prepare(`SELECT slug FROM articles WHERE slug IS NOT NULL AND content != '' ORDER BY sort`),
    db.prepare(`SELECT username FROM users WHERE public_profile = 1 AND blocked = 0 LIMIT 1000`),
  ]);

  const staticPages = ['/', '/sabitiya', '/novini', '/obuchenie', '/klasatsiya'];
  const urls: string[] = staticPages.map(
    (p) => `<url><loc>${origin}${p}</loc><changefreq>hourly</changefreq><priority>${p === '/' ? '1.0' : '0.8'}</priority></url>`
  );
  for (const row of posts.results as { slug: string; created_at: string }[]) {
    urls.push(
      `<url><loc>${origin}/t/${row.slug}</loc><lastmod>${parseDbDate(row.created_at).toISOString()}</lastmod><priority>0.7</priority></url>`
    );
  }
  for (const row of news.results as { slug: string; published_at: string }[]) {
    urls.push(
      `<url><loc>${origin}/novini/${row.slug}</loc><lastmod>${parseDbDate(row.published_at).toISOString()}</lastmod><priority>0.6</priority></url>`
    );
  }
  for (const row of courses.results as { slug: string }[]) {
    urls.push(`<url><loc>${origin}/obuchenie/${row.slug}</loc><priority>0.6</priority></url>`);
  }
  for (const row of lessons.results as { course_slug: string; lesson_slug: string }[]) {
    urls.push(`<url><loc>${origin}/obuchenie/${row.course_slug}/${row.lesson_slug}</loc><priority>0.5</priority></url>`);
  }
  for (const row of articles.results as { slug: string }[]) {
    urls.push(`<url><loc>${origin}/statii/${row.slug}</loc><priority>0.5</priority></url>`);
  }
  for (const row of profiles.results as { username: string }[]) {
    urls.push(`<url><loc>${origin}/u/${row.username}</loc><priority>0.3</priority></url>`);
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
