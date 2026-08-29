import type { APIRoute } from 'astro';
import { clearSessionCookie } from '../../../lib/auth';
import { hasTable } from '../../../lib/schema';

/**
 * Irreversibly deletes the account: posts and comments stay but are anonymized
 * (the user row is scrubbed and locked), matching the promise in the settings UI.
 */
export const POST: APIRoute = async ({ locals, cookies, redirect }) => {
  const user = locals.user;
  if (!user) return redirect('/vhod', 303);

  const db = locals.runtime.env.DB;
  const commentVotes = await hasTable(db, 'comment_votes');
  const projectVotes = await hasTable(db, 'project_votes');
  await db.batch([
    db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(user.id),
    db.prepare('DELETE FROM votes WHERE user_id = ?').bind(user.id),
    ...(commentVotes ? [db.prepare('DELETE FROM comment_votes WHERE user_id = ?').bind(user.id)] : []),
    ...(projectVotes ? [db.prepare('DELETE FROM project_votes WHERE user_id = ?').bind(user.id)] : []),
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
