import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const user = locals.user;
  if (!user) return redirect('/vhod', 303);
  if (user.role !== 'admin') return redirect('/', 303);

  const db = locals.runtime.env.DB;
  const form = await request.formData();
  const targetId = Number(form.get('user_id'));

  if (targetId && targetId !== user.id) {
    await db.prepare('UPDATE users SET blocked = 1 - blocked WHERE id = ?').bind(targetId).run();
    // Blocking also ends the user's active sessions.
    await db
      .prepare('DELETE FROM sessions WHERE user_id = ? AND (SELECT blocked FROM users WHERE id = ?) = 1')
      .bind(targetId, targetId)
      .run();
  }
  return redirect('/admin', 303);
};
