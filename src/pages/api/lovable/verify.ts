import type { APIRoute } from 'astro';
import { fetchBadgeLevel, normalizeBadgeUrl } from '../../../lib/lovable';

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const user = locals.user;
  if (!user) return redirect('/vhod', 303);

  const db = locals.runtime.env.DB;
  const form = await request.formData();
  const url = normalizeBadgeUrl(String(form.get('url') ?? ''));
  if (!url) return redirect('/nastroyki?greshka=lovable-url-nevaliden', 303);

  const taken = await db
    .prepare('SELECT 1 FROM users WHERE lovable_badge_url = ? AND id != ?')
    .bind(url, user.id)
    .first();
  if (taken) return redirect('/nastroyki?greshka=lovable-url-zaet', 303);

  const level = await fetchBadgeLevel(url);
  if (!level) return redirect('/nastroyki?greshka=lovable-ne-otkrit', 303);

  await db
    .prepare(
      `UPDATE users SET lovable_level = ?, lovable_badge_url = ?, lovable_verified_via = 'url',
         lovable_synced_at = datetime('now') WHERE id = ?`
    )
    .bind(level, url, user.id)
    .run();

  return redirect('/nastroyki?lovable=ok', 303);
};
