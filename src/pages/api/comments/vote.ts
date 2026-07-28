import type { APIRoute } from 'astro';
import { commentFeatures } from '../../../lib/schema';

/** Toggles an upvote on a comment. Mirrors /api/vote: JSON when asked, else a redirect. */
export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const wantsJson = request.headers.get('accept')?.includes('application/json');
  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

  const user = locals.user;
  if (!user) return wantsJson ? json({ error: 'unauthorized' }, 401) : redirect('/vhod', 303);

  const db = locals.runtime.env.DB;
  const form = await request.formData();
  const commentId = Number(form.get('comment_id'));
  const backRaw = String(form.get('back') ?? '/');
  const back = backRaw.startsWith('/') && !backRaw.startsWith('//') ? backRaw : '/';

  const features = await commentFeatures(db);
  if (!features.votes) return wantsJson ? json({ error: 'unavailable' }, 404) : redirect(back, 303);
  if (user.blocked) return wantsJson ? json({ error: 'blocked' }, 403) : redirect(back, 303);

  const comment = await db
    .prepare(
      `SELECT c.id FROM comments c JOIN posts p ON p.id = c.post_id
       WHERE c.id = ? AND p.hidden = 0${features.deletes ? ' AND c.deleted_at IS NULL' : ''}`
    )
    .bind(commentId)
    .first<{ id: number }>();
  if (!comment) return wantsJson ? json({ error: 'not_found' }, 404) : redirect(back, 303);

  const existing = await db
    .prepare('SELECT 1 FROM comment_votes WHERE user_id = ? AND comment_id = ?')
    .bind(user.id, commentId)
    .first();

  if (existing) {
    await db.prepare('DELETE FROM comment_votes WHERE user_id = ? AND comment_id = ?').bind(user.id, commentId).run();
  } else {
    await db.prepare('INSERT INTO comment_votes (user_id, comment_id) VALUES (?, ?)').bind(user.id, commentId).run();
  }

  if (wantsJson) {
    const row = await db
      .prepare('SELECT COUNT(*) AS votes FROM comment_votes WHERE comment_id = ?')
      .bind(commentId)
      .first<{ votes: number }>();
    return json({ votes: row?.votes ?? 0, voted: !existing });
  }
  return redirect(back, 303);
};
