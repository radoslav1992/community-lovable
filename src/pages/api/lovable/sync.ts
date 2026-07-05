import type { APIRoute } from 'astro';
import { fetchProfileHtml, parseProfileBadges } from '../../../lib/lovable';

/** Manual "refresh now" for a verified profile's badges. */
export const POST: APIRoute = async ({ locals, redirect }) => {
  const user = locals.user;
  if (!user) return redirect('/vhod', 303);
  if (!user.lovable_profile_url) return redirect('/nastroyki', 303);

  const db = locals.runtime.env.DB;
  const html = await fetchProfileHtml(user.lovable_profile_url);
  if (html === null) {
    await db.prepare("UPDATE users SET lovable_synced_at = datetime('now') WHERE id = ?").bind(user.id).run();
    return redirect('/nastroyki?greshka=lovable-profil-nedostapen', 303);
  }

  const parsed = parseProfileBadges(html);
  await db
    .prepare(
      `UPDATE users SET lovable_top_percent = ?, lovable_badges = ?, lovable_synced_at = datetime('now')
       WHERE id = ?`
    )
    .bind(parsed.topPercent, JSON.stringify(parsed.badges), user.id)
    .run();
  return redirect('/nastroyki?lovable=ok', 303);
};
