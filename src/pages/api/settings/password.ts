import type { APIRoute } from 'astro';
import { hashPassword, verifyPassword } from '../../../lib/auth';

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const user = locals.user;
  if (!user) return redirect('/vhod', 303);

  const db = locals.runtime.env.DB;
  const form = await request.formData();
  const current = String(form.get('current_password') ?? '');
  const next = String(form.get('new_password') ?? '');

  if (next.length < 8) return redirect('/nastroyki?greshka=slaba-parola', 303);

  const row = await db
    .prepare('SELECT password_hash FROM users WHERE id = ?')
    .bind(user.id)
    .first<{ password_hash: string | null }>();

  // OAuth accounts have no password yet — they may set one without a current password.
  if (row?.password_hash && !(await verifyPassword(current, row.password_hash))) {
    return redirect('/nastroyki?greshka=greshna-parola', 303);
  }

  await db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(await hashPassword(next), user.id).run();
  return redirect('/nastroyki?zapazeno=1', 303);
};
