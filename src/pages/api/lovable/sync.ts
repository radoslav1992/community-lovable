import type { APIRoute } from 'astro';
import { fetchAndParseProfile } from '../../../lib/lovable';

/** Manual "refresh now" for a verified profile's badges. */
export const POST: APIRoute = async ({ locals, redirect }) => {
  const user = locals.user;
  if (!user) return redirect('/vhod', 303);
  if (!user.lovable_profile_url) return redirect('/nastroyki', 303);

  const db = locals.runtime.env.DB;
  const { html, parsed } = await fetchAndParseProfile(user.lovable_profile_url);
  if (html === null || parsed === null) {
    await db.prepare("UPDATE users SET lovable_synced_at = datetime('now') WHERE id = ?").bind(user.id).run();
    return redirect('/nastroyki?greshka=lovable-profil-nedostapen', 303);
  }
  await db
    .prepare(
      `UPDATE users SET lovable_top_percent = ?, lovable_badges = ?, lovable_edits = ?,
         lovable_stats = ?, lovable_synced_at = datetime('now') WHERE id = ?`
    )
    .bind(parsed.topPercent, JSON.stringify(parsed.badges), parsed.edits, JSON.stringify(parsed.stats), user.id)
    .run();
  // Distinguish "page read but stats missing" from a full success so parse
  // regressions are visible to the member instead of silently showing "—".
  return redirect(parsed.edits === null ? '/nastroyki?lovable=bez-danni' : '/nastroyki?lovable=ok', 303);
};
