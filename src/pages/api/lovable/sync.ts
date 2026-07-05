import type { APIRoute } from 'astro';
import { fetchBadgeLevel } from '../../../lib/lovable';

/** Manual "refresh now" for a URL-verified badge. */
export const POST: APIRoute = async ({ locals, redirect }) => {
  const user = locals.user;
  if (!user) return redirect('/vhod', 303);
  if (user.lovable_verified_via !== 'url' || !user.lovable_badge_url) {
    return redirect('/nastroyki', 303);
  }

  const db = locals.runtime.env.DB;
  const level = await fetchBadgeLevel(user.lovable_badge_url);
  if (!level) {
    await db.prepare("UPDATE users SET lovable_synced_at = datetime('now') WHERE id = ?").bind(user.id).run();
    return redirect('/nastroyki?greshka=lovable-ne-otkrit', 303);
  }

  await db
    .prepare("UPDATE users SET lovable_level = ?, lovable_synced_at = datetime('now') WHERE id = ?")
    .bind(level, user.id)
    .run();
  return redirect('/nastroyki?lovable=ok', 303);
};
