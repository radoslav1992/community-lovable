import type { APIRoute } from 'astro';
import { verifyPassword, createSession, setSessionCookie } from '../../../lib/auth';

export const POST: APIRoute = async ({ request, locals, cookies, redirect }) => {
  const db = locals.runtime.env.DB;
  const form = await request.formData();
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  const password = String(form.get('password') ?? '');

  const back = (err: string) => redirect(`/vhod?greshka=${err}&email=${encodeURIComponent(email)}`, 303);

  const user = await db
    .prepare('SELECT id, password_hash, blocked FROM users WHERE email = ?')
    .bind(email)
    .first<{ id: number; password_hash: string | null; blocked: number }>();

  if (!user || !(await verifyPassword(password, user.password_hash))) return back('greshni-danni');
  if (user.blocked) return back('blokiran');

  const { token, expires } = await createSession(db, user.id);
  setSessionCookie(cookies, token, expires);
  return redirect('/', 303);
};
