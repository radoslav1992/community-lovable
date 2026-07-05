import type { APIRoute } from 'astro';
import { emailConfigured, sendEmail } from '../../../lib/email';
import { LOVABLE_LEVELS } from '../../../lib/lovable';

const CODE_TTL_MINUTES = 30;
const RESEND_COOLDOWN_SECONDS = 60;

/** Email fallback, step 1: send a confirmation code to the account email. */
export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const user = locals.user;
  if (!user) return redirect('/vhod', 303);

  const env = locals.runtime.env;
  if (!emailConfigured(env)) return redirect('/nastroyki?greshka=lovable-imeyl-nedostapen', 303);

  const form = await request.formData();
  const level = parseInt(String(form.get('level') ?? ''), 10);
  if (!LOVABLE_LEVELS[level]) return redirect('/nastroyki?greshka=nevalidni-danni', 303);

  const db = env.DB;
  const recent = await db
    .prepare(
      `SELECT 1 FROM lovable_email_claims
       WHERE user_id = ? AND created_at > datetime('now', '-' || ? || ' seconds')`
    )
    .bind(user.id, RESEND_COOLDOWN_SECONDS)
    .first();
  if (recent) return redirect('/nastroyki?greshka=lovable-tvarde-chesto', 303);

  const code = String(crypto.getRandomValues(new Uint32Array(1))[0]! % 1_000_000).padStart(6, '0');
  await db.batch([
    db.prepare('DELETE FROM lovable_email_claims WHERE user_id = ?').bind(user.id),
    db
      .prepare(
        `INSERT INTO lovable_email_claims (user_id, code, level, expires_at)
         VALUES (?, ?, ?, datetime('now', '+' || ? || ' minutes'))`
      )
      .bind(user.id, code, level, CODE_TTL_MINUTES),
  ]);

  const sent = await sendEmail(
    env,
    user.email,
    'Код за потвърждение на Lovable значка',
    `Здравей, ${user.name}!\n\n` +
      `Кодът за потвърждение на твоето Vibe Coding ниво (${LOVABLE_LEVELS[level]!.label}) е: ${code}\n\n` +
      `Кодът е валиден ${CODE_TTL_MINUTES} минути. Ако не си заявявал(а) значка, игнорирай този имейл.\n\n` +
      `— Българска Lovable Общност`
  );
  if (!sent) {
    await db.prepare('DELETE FROM lovable_email_claims WHERE user_id = ?').bind(user.id).run();
    return redirect('/nastroyki?greshka=lovable-imeyl-neuspeshen', 303);
  }

  return redirect('/nastroyki?lovable=kod', 303);
};
