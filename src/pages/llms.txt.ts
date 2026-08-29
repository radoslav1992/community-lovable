import type { APIRoute } from 'astro';
import { bgDate } from '../lib/format';

// llms.txt манифест (https://llmstxt.org) — курирана карта на сайта за
// AI асистенти и LLM търсачки.
export const GET: APIRoute = async ({ locals, site }) => {
  const db = locals.runtime.env.DB;
  const origin = (site ?? new URL('https://communitylovable.bg')).origin;

  const [articles, posts, news] = await Promise.all([
    db
      .prepare(`SELECT slug, title, meta FROM articles WHERE content != '' AND slug IS NOT NULL ORDER BY sort`)
      .all<{ slug: string; title: string; meta: string }>(),
    db
      .prepare(
        `SELECT p.title, p.slug, p.excerpt, u.name AS author
         FROM posts p JOIN users u ON u.id = p.user_id
         WHERE p.hidden = 0 ORDER BY p.created_at DESC LIMIT 20`
      )
      .all<{ title: string; slug: string; excerpt: string; author: string }>(),
    db
      .prepare(`SELECT slug, title, excerpt, published_at FROM news ORDER BY published_at DESC LIMIT 10`)
      .all<{ slug: string; title: string; excerpt: string; published_at: string }>(),
  ]);

  const lines = [
    '# Българска Lovable Общност',
    '',
    '> Мястото на българските Lovable билдъри — независима общност, водена от доброволци. Дискусии, събития, новини и обучение за създаване на уеб приложения с Lovable, изцяло на български език.',
    '',
    'Съдържанието е на български. Публикациите се създават от членовете на общността, а статиите и обученията — от екипа на общността.',
    '',
    '## Основни страници',
    '',
    `- [Начало](${origin}/): емисия с последните дискусии на общността`,
    `- [Проекти](${origin}/proekti): галерия с проекти, направени с Lovable от общността`,
    `- [Обучение](${origin}/obuchenie): курсове и статии за работа с Lovable на български`,
    `- [Събития](${origin}/sabitiya): предстоящи срещи на общността`,
    `- [Новини](${origin}/novini): новини от общността и платформата`,
    `- [Класация](${origin}/klasatsiya): най-активните членове`,
    '',
    '## Статии',
    '',
    ...articles.results.map((a) => `- [${a.title}](${origin}/statii/${a.slug}): ${a.meta}`),
    '',
    '## Последни новини',
    '',
    ...news.results.map((n) => `- [${n.title}](${origin}/novini/${n.slug}) (${bgDate(n.published_at)}): ${n.excerpt}`),
    '',
    '## Последни дискусии',
    '',
    ...posts.results.map((p) => `- [${p.title}](${origin}/t/${p.slug}) от ${p.author}: ${p.excerpt}`),
    '',
    '## Optional',
    '',
    `- [RSS емисия](${origin}/rss.xml): последните публикации като RSS`,
    `- [Карта на сайта](${origin}/sitemap-index.xml): пълен списък с всички страници`,
    '',
  ];

  return new Response(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=600',
    },
  });
};
