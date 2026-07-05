// Transactional email via Resend. Requires the RESEND_API_KEY secret; the
// optional EMAIL_FROM overrides the default sender address.

const DEFAULT_FROM = 'Lovable Общност <noreply@communitylovable.bg>';

export function emailConfigured(env: Env): boolean {
  return !!env.RESEND_API_KEY;
}

export async function sendEmail(env: Env, to: string, subject: string, text: string): Promise<boolean> {
  if (!env.RESEND_API_KEY) return false;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: env.EMAIL_FROM || DEFAULT_FROM, to: [to], subject, text }),
  });
  return res.ok;
}
