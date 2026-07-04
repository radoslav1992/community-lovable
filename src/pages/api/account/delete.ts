import type { APIRoute } from 'astro';
import { clearSessionCookie } from '../../../lib/auth';

/**
 * Irreversibly deletes the account: posts and comments stay but are anonymized
 * (the user row is scrubbed and locked), matching the promise in the settings UI.
 */
export const POST: APIRoute = async ({ locals, cookies, redirect }) => {
  const user = locals.user;
  if (!user) return redirect('/vhod', 303);

  const db = locals.runtime.env.DB;
  await db.batch([
    db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(user.id),
    db.prepare('DELETE FROM votes WHERE user_id = ?').bind(user.id),
    db.prepare('DELETE FROM rsvps WHERE user_id = ?').bind(user.id),
    db
      .prepare(
        `UPDATE users SET
          name = 'Изтрит профил',
          email = 'deleted-' || id || '@communitylovable.bg',
          username = 'deleted-' || id,
          password_hash = NULL,
          bio = '',
          role = 'member',
          blocked = 1
        WHERE id = ?`
      )
      .bind(user.id),
  ]);

  clearSessionCookie(cookies);
  return redirect('/', 303);
};
