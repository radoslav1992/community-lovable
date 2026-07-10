import type { APIRoute } from 'astro';
import { slugify, uniqueSlug } from '../../../lib/slug';

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const user = locals.user;
  if (!user) return redirect('/vhod', 303);
  if (user.role !== 'admin') return redirect('/', 303);

  const db = locals.runtime.env.DB;
  const form = await request.formData();
  const action = String(form.get('action'));
  const back = '/admin#novini';

  if (action === 'delete') {
    const id = Number(form.get('id'));
    if (id) await db.prepare('DELETE FROM news WHERE id = ?').bind(id).run();
    return redirect(back, 303);
  }

  const title = String(form.get('title') ?? '').trim().slice(0, 200);
  const body = String(form.get('body') ?? '').trim().slice(0, 20_000);
  const excerptRaw = String(form.get('excerpt') ?? '').trim().slice(0, 300);
  const excerpt = excerptRaw || body.split(/\n\n+/)[0]!.slice(0, 180);
  const featured = form.get('featured') === '1' ? 1 : 0;

  if (!title || !body) return redirect('/admin?greshka=novina#novini', 303);

  if (action === 'update') {
    const id = Number(form.get('id'));
    if (id) {
      // Only one featured news item at a time keeps the list layout sane.
      if (featured) await db.prepare('UPDATE news SET featured = 0 WHERE id != ?').bind(id).run();
      await db
        .prepare('UPDATE news SET title = ?, excerpt = ?, body = ?, featured = ? WHERE id = ?')
        .bind(title, excerpt, body, featured, id)
        .run();
    }
    return redirect(back, 303);
  }

  if (featured) await db.prepare('UPDATE news SET featured = 0').run();
  const slug = await uniqueSlug(db, 'news', slugify(title));
  await db
    .prepare(`INSERT INTO news (slug, title, excerpt, body, featured, published_at) VALUES (?, ?, ?, ?, ?, datetime('now'))`)
    .bind(slug, title, excerpt, body, featured)
    .run();
  return redirect(back, 303);
};
