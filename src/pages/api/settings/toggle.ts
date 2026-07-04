import type { APIRoute } from 'astro';

const ALLOWED = ['notif_email', 'notif_digest', 'public_profile'] as const;

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const user = locals.user;
  if (!user) return redirect('/vhod', 303);

  const form = await request.formData();
  const key = String(form.get('key') ?? '') as (typeof ALLOWED)[number];
  if (ALLOWED.includes(key)) {
    await locals.runtime.env.DB
      .prepare(`UPDATE users SET ${key} = 1 - ${key} WHERE id = ?`)
      .bind(user.id)
      .run();
  }
  return redirect('/nastroyki', 303);
};
