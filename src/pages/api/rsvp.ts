import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const user = locals.user;
  if (!user) return redirect('/vhod', 303);

  const db = locals.runtime.env.DB;
  const form = await request.formData();
  const eventId = Number(form.get('event_id'));

  const event = await db.prepare('SELECT id FROM events WHERE id = ?').bind(eventId).first();
  if (event) {
    const existing = await db
      .prepare('SELECT 1 FROM rsvps WHERE user_id = ? AND event_id = ?')
      .bind(user.id, eventId)
      .first();
    if (existing) {
      await db.prepare('DELETE FROM rsvps WHERE user_id = ? AND event_id = ?').bind(user.id, eventId).run();
    } else {
      await db.prepare('INSERT INTO rsvps (user_id, event_id) VALUES (?, ?)').bind(user.id, eventId).run();
    }
  }
  return redirect('/sabitiya', 303);
};
