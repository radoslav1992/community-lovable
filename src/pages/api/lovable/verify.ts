import type { APIRoute } from 'astro';
import { fetchProfileHtml, parseProfileBadges } from '../../../lib/lovable';

/** Step 2: fetch the claimed profile, look for the bio code, and verify. */
export const POST: APIRoute = async ({ locals, redirect }) => {
  const user = locals.user;
  if (!user) return redirect('/vhod', 303);

  const db = locals.runtime.env.DB;
  const claim = await db
    .prepare(
      `SELECT profile_url, username, code FROM lovable_profile_claims
       WHERE user_id = ? AND expires_at > datetime('now')`
    )
    .bind(user.id)
    .first<{ profile_url: string; username: string; code: string }>();
  if (!claim) return redirect('/nastroyki?greshka=lovable-nyama-zayavka', 303);

  // Re-check uniqueness at verification time (someone may have verified the
  // same profile while this claim was pending).
  const taken = await db
    .prepare('SELECT 1 FROM users WHERE lovable_profile_url = ? AND id != ?')
    .bind(claim.profile_url, user.id)
    .first();
  if (taken) return redirect('/nastroyki?greshka=lovable-profil-zaet', 303);

  const html = await fetchProfileHtml(claim.profile_url);
  if (html === null) return redirect('/nastroyki?greshka=lovable-profil-nedostapen', 303);
  if (!html.includes(claim.code)) return redirect('/nastroyki?greshka=lovable-kod-lipsva', 303);

  const parsed = parseProfileBadges(html);
  await db.batch([
    db
      .prepare(
        `UPDATE users SET lovable_profile_url = ?, lovable_username = ?, lovable_top_percent = ?,
           lovable_badges = ?, lovable_edits = ?, lovable_stats = ?, lovable_synced_at = datetime('now')
         WHERE id = ?`
      )
      .bind(
        claim.profile_url,
        claim.username,
        parsed.topPercent,
        JSON.stringify(parsed.badges),
        parsed.edits,
        JSON.stringify(parsed.stats),
        user.id
      ),
    db.prepare('DELETE FROM lovable_profile_claims WHERE user_id = ?').bind(user.id),
  ]);

  return redirect('/nastroyki?lovable=ok', 303);
};
