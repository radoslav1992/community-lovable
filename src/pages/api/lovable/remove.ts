import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ locals, redirect }) => {
  const user = locals.user;
  if (!user) return redirect('/vhod', 303);

  const db = locals.runtime.env.DB;
  await db.batch([
    db
      .prepare(
        `UPDATE users SET lovable_level = 0, lovable_badge_url = NULL,
           lovable_verified_via = NULL, lovable_synced_at = NULL WHERE id = ?`
      )
      .bind(user.id),
    db.prepare('DELETE FROM lovable_email_claims WHERE user_id = ?').bind(user.id),
  ]);

  return redirect('/nastroyki?lovable=premahnato', 303);
};
