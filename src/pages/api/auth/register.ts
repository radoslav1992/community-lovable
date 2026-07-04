import type { APIRoute } from 'astro';
import { hashPassword, createSession, setSessionCookie } from '../../../lib/auth';
import { slugify } from '../../../lib/slug';

export const POST: APIRoute = async ({ request, locals, cookies, redirect }) => {
  const db = locals.runtime.env.DB;
  const form = await request.formData();
  const name = String(form.get('name') ?? '').trim();
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  const password = String(form.get('password') ?? '');

  const back = (err: string) =>
    redirect(`/vhod?tab=registratsiya&greshka=${err}&email=${encodeURIComponent(email)}`, 303);

  if (!name || name.length > 80 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return back('nevalidni-danni');
  if (password.length < 8) return back('slaba-parola');

  const existing = await db.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
  if (existing) return back('zaet-imeyl');

  // Derive a unique latin username from the name.
  const base = slugify(name, 30).replace(/-/g, '') || 'user';
  let username = base;
  for (let i = 2; ; i++) {
    const taken = await db.prepare('SELECT 1 FROM users WHERE username = ?').bind(username).first();
    if (!taken) break;
    username = `${base}${i}`;
  }

  const passwordHash = await hashPassword(password);
  const result = await db
    .prepare('INSERT INTO users (email, username, name, password_hash) VALUES (?, ?, ?, ?) RETURNING id')
    .bind(email, username, name, passwordHash)
    .first<{ id: number }>();
  if (!result) return back('nevalidni-danni');

  const { token, expires } = await createSession(db, result.id);
  setSessionCookie(cookies, token, expires);
  return redirect('/', 303);
};
