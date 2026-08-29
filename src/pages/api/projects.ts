import type { APIRoute } from 'astro';
import { PROJECT_CATEGORIES, normalizeProjectUrl, normalizeRemixUrl, parseTags } from '../../lib/projects';
import { hasColumn, hasTable } from '../../lib/schema';

/** Добавяне на проект в публичния showcase (/proekti). */
export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const user = locals.user;
  if (!user) return redirect('/vhod', 303);
  if (user.blocked) return redirect('/proekti?greshka=blokiran', 303);

  const db = locals.runtime.env.DB;
  if (!(await hasTable(db, 'projects'))) return redirect('/proekti', 303);

  const form = await request.formData();
  const title = String(form.get('title') ?? '').trim().slice(0, 120);
  const tagline = String(form.get('tagline') ?? '').trim().slice(0, 300);
  const categoryRaw = String(form.get('category') ?? 'Друго');
  const category = PROJECT_CATEGORIES.includes(categoryRaw) ? categoryRaw : 'Друго';
  const url = normalizeProjectUrl(String(form.get('url') ?? ''));
  const remixUrl = normalizeRemixUrl(String(form.get('remix_url') ?? ''));
  const tags = parseTags(String(form.get('tags') ?? '')).join(',');

  if (!title) return redirect('/proekti?dobavi=1&greshka=zaglavie#dobavi', 303);
  if (!url) return redirect('/proekti?dobavi=1&greshka=adres#dobavi', 303);

  const duplicate = await db.prepare('SELECT id FROM projects WHERE url = ?').bind(url).first();
  if (duplicate) return redirect('/proekti?greshka=dublikat', 303);

  // Витрината (миграция 0015) може още да не е приложена — тогава пишем само
  // основните колони.
  if (await hasColumn(db, 'projects', 'remix_url')) {
    await db
      .prepare(
        'INSERT INTO projects (user_id, title, url, tagline, category, tags, remix_url) VALUES (?, ?, ?, ?, ?, ?, ?)'
      )
      .bind(user.id, title, url, tagline, category, tags, remixUrl)
      .run();
  } else {
    await db
      .prepare('INSERT INTO projects (user_id, title, url, tagline, category) VALUES (?, ?, ?, ?, ?)')
      .bind(user.id, title, url, tagline, category)
      .run();
  }

  return redirect('/proekti?dobaven=1', 303);
};
