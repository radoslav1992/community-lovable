import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const user = locals.user;
  if (!user) return redirect('/vhod', 303);

  const db = locals.runtime.env.DB;
  const form = await request.formData();
  const name = String(form.get('name') ?? '').trim();
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  const bio = String(form.get('bio') ?? '').trim().slice(0, 300);

  if (!name || name.length > 80 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return redirect('/nastroyki?greshka=nevalidni-danni', 303);
  }

  const emailTaken = await db
    .prepare('SELECT 1 FROM users WHERE email = ? AND id != ?')
    .bind(email, user.id)
    .first();
  if (emailTaken) return redirect('/nastroyki?greshka=zaet-imeyl', 303);

  await db
    .prepare('UPDATE users SET name = ?, email = ?, bio = ? WHERE id = ?')
    .bind(name, email, bio, user.id)
    .run();

  return redirect('/nastroyki?zapazeno=1', 303);
};
