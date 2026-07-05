import type { APIRoute } from 'astro';

/** Unlinks the Lovable profile, or cancels a pending claim. */
export const POST: APIRoute = async ({ locals, redirect }) => {
  const user = locals.user;
  if (!user) return redirect('/vhod', 303);

  const db = locals.runtime.env.DB;
  await db.batch([
    db
      .prepare(
        `UPDATE users SET lovable_profile_url = NULL, lovable_username = NULL,
           lovable_top_percent = NULL, lovable_badges = '[]', lovable_edits = NULL,
           lovable_stats = '{}', lovable_synced_at = NULL WHERE id = ?`
      )
      .bind(user.id),
    db.prepare('DELETE FROM lovable_profile_claims WHERE user_id = ?').bind(user.id),
  ]);

  return redirect('/nastroyki?lovable=premahnato', 303);
};
