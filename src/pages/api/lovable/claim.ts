import type { APIRoute } from 'astro';
import { CLAIM_TTL_HOURS, generateClaimCode, normalizeProfileUrl } from '../../../lib/lovable';

/** Step 1: register a claim for a lovable.dev profile and issue a bio code. */
export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const user = locals.user;
  if (!user) return redirect('/vhod', 303);

  const db = locals.runtime.env.DB;
  const form = await request.formData();
  const profile = normalizeProfileUrl(String(form.get('profile') ?? ''));
  if (!profile) return redirect('/nastroyki?greshka=lovable-profil-nevaliden', 303);

  const taken = await db
    .prepare('SELECT 1 FROM users WHERE lovable_profile_url = ? AND id != ?')
    .bind(profile.url, user.id)
    .first();
  if (taken) return redirect('/nastroyki?greshka=lovable-profil-zaet', 303);

  const code = generateClaimCode();
  await db.batch([
    db.prepare('DELETE FROM lovable_profile_claims WHERE user_id = ?').bind(user.id),
    db
      .prepare(
        `INSERT INTO lovable_profile_claims (user_id, profile_url, username, code, expires_at)
         VALUES (?, ?, ?, ?, datetime('now', '+' || ? || ' hours'))`
      )
      .bind(user.id, profile.url, profile.username, code, CLAIM_TTL_HOURS),
  ]);

  return redirect('/nastroyki?lovable=kod', 303);
};
