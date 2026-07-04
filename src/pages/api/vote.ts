import type { APIRoute } from 'astro';

/** Toggle an upvote. Returns JSON when requested (progressive enhancement), else redirects back. */
export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const user = locals.user;
  const wantsJson = request.headers.get('accept')?.includes('application/json');
  if (!user) {
    return wantsJson
      ? new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } })
      : redirect('/vhod', 303);
  }

  const db = locals.runtime.env.DB;
  const form = await request.formData();
  const postId = Number(form.get('post_id'));
  const backRaw = String(form.get('back') ?? '/');
  const back = backRaw.startsWith('/') && !backRaw.startsWith('//') ? backRaw : '/';

  const post = await db.prepare('SELECT id FROM posts WHERE id = ? AND hidden = 0').bind(postId).first();
  if (!post) return wantsJson ? new Response(null, { status: 404 }) : redirect(back, 303);

  const existing = await db
    .prepare('SELECT 1 FROM votes WHERE user_id = ? AND post_id = ?')
    .bind(user.id, postId)
    .first();

  if (existing) {
    await db.prepare('DELETE FROM votes WHERE user_id = ? AND post_id = ?').bind(user.id, postId).run();
  } else {
    await db.prepare('INSERT INTO votes (user_id, post_id) VALUES (?, ?)').bind(user.id, postId).run();
  }

  if (wantsJson) {
    const row = await db
      .prepare('SELECT base_votes + (SELECT COUNT(*) FROM votes v WHERE v.post_id = posts.id) AS votes FROM posts WHERE id = ?')
      .bind(postId)
      .first<{ votes: number }>();
    return new Response(JSON.stringify({ votes: row?.votes ?? 0, voted: !existing }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return redirect(back, 303);
};
