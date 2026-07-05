import type { APIRoute } from 'astro';

/** Email fallback, step 2: confirm the code and apply the claimed level. */
export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const user = locals.user;
  if (!user) return redirect('/vhod', 303);

  const db = locals.runtime.env.DB;
  const form = await request.formData();
  const code = String(form.get('code') ?? '').trim();
  if (!/^\d{6}$/.test(code)) return redirect('/nastroyki?greshka=lovable-kod-greshen', 303);

  const claim = await db
    .prepare(
      `SELECT id, level FROM lovable_email_claims
       WHERE user_id = ? AND code = ? AND expires_at > datetime('now')`
    )
    .bind(user.id, code)
    .first<{ id: number; level: number }>();
  if (!claim) return redirect('/nastroyki?greshka=lovable-kod-greshen', 303);

  await db.batch([
    db
      .prepare(
        `UPDATE users SET lovable_level = ?, lovable_badge_url = NULL,
           lovable_verified_via = 'email', lovable_synced_at = datetime('now') WHERE id = ?`
      )
      .bind(claim.level, user.id),
    db.prepare('DELETE FROM lovable_email_claims WHERE user_id = ?').bind(user.id),
  ]);

  return redirect('/nastroyki?lovable=ok', 303);
};
