import type { APIRoute } from 'astro';
import { slugify, uniqueSlug } from '../../../lib/slug';

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const user = locals.user;
  if (!user) return redirect('/vhod', 303);
  if (user.role !== 'admin') return redirect('/', 303);

  const db = locals.runtime.env.DB;
  const form = await request.formData();
  const action = String(form.get('action'));
  const back = '/admin#sabitiya';

  if (action === 'delete') {
    const id = Number(form.get('id'));
    if (id) {
      await db.prepare('DELETE FROM rsvps WHERE event_id = ?').bind(id).run();
      await db.prepare('DELETE FROM events WHERE id = ?').bind(id).run();
    }
    return redirect(back, 303);
  }

  const title = String(form.get('title') ?? '').trim().slice(0, 200);
  const date = String(form.get('date') ?? '').trim();
  const time = String(form.get('time') ?? '').trim() || '00:00';
  const isLive = form.get('is_live') === '1' ? 1 : 0;
  const place = String(form.get('place') ?? '').trim().slice(0, 200);
  const description = String(form.get('description') ?? '').trim().slice(0, 2000);

  if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
    return redirect('/admin?greshka=sabitie#sabitiya', 303);
  }
  const startsAt = `${date} ${time}:00`;

  if (action === 'update') {
    const id = Number(form.get('id'));
    if (id) {
      await db
        .prepare('UPDATE events SET title = ?, starts_at = ?, is_live = ?, place = ?, description = ? WHERE id = ?')
        .bind(title, startsAt, isLive, place, description, id)
        .run();
    }
    return redirect(back, 303);
  }

  const slug = await uniqueSlug(db, 'events', slugify(title));
  await db
    .prepare('INSERT INTO events (slug, title, starts_at, is_live, place, description) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(slug, title, startsAt, isLive, place, description)
    .run();
  return redirect(back, 303);
};
