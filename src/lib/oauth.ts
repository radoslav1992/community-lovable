import { uniqueUsername } from './auth';
import { slugify } from './slug';

export type OAuthProvider = 'google' | 'github';

export interface OAuthProfile {
  sub: string;
  email: string;
  name: string;
}

interface ProviderConfig {
  clientId: string;
  clientSecret: string;
  authorizeUrl: string;
  scope: string;
}

export function getProviderConfig(env: Env, provider: OAuthProvider): ProviderConfig | null {
  if (provider === 'google') {
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return null;
    return {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      scope: 'openid email profile',
    };
  }
  if (provider === 'github') {
    if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) return null;
    return {
      clientId: env.GITHUB_CLIENT_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET,
      authorizeUrl: 'https://github.com/login/oauth/authorize',
      scope: 'read:user user:email',
    };
  }
  return null;
}

export function callbackUrl(origin: string, provider: OAuthProvider): string {
  return `${origin}/api/auth/callback/${provider}`;
}

/** Exchanges the authorization code and fetches the user profile. Throws on any failure. */
export async function fetchProfile(
  provider: OAuthProvider,
  cfg: ProviderConfig,
  code: string,
  redirectUri: string
): Promise<OAuthProfile> {
  if (provider === 'google') {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    if (!tokenRes.ok) throw new Error(`google token: ${tokenRes.status}`);
    const token = (await tokenRes.json()) as { access_token?: string };
    if (!token.access_token) throw new Error('google token: missing access_token');

    const infoRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    if (!infoRes.ok) throw new Error(`google userinfo: ${infoRes.status}`);
    const info = (await infoRes.json()) as { sub?: string; email?: string; name?: string };
    if (!info.sub || !info.email) throw new Error('google userinfo: missing sub/email');
    return { sub: info.sub, email: info.email.toLowerCase(), name: info.name || info.email.split('@')[0]! };
  }

  // github
  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({
      code,
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      redirect_uri: redirectUri,
    }),
  });
  if (!tokenRes.ok) throw new Error(`github token: ${tokenRes.status}`);
  const token = (await tokenRes.json()) as { access_token?: string };
  if (!token.access_token) throw new Error('github token: missing access_token');

  const ghHeaders = {
    Authorization: `Bearer ${token.access_token}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'communitylovable-bg',
  };
  const userRes = await fetch('https://api.github.com/user', { headers: ghHeaders });
  if (!userRes.ok) throw new Error(`github user: ${userRes.status}`);
  const ghUser = (await userRes.json()) as { id: number; login: string; name: string | null; email: string | null };

  let email = ghUser.email;
  if (!email) {
    const emailsRes = await fetch('https://api.github.com/user/emails', { headers: ghHeaders });
    if (emailsRes.ok) {
      const emails = (await emailsRes.json()) as { email: string; primary: boolean; verified: boolean }[];
      email = emails.find((e) => e.primary && e.verified)?.email ?? emails.find((e) => e.verified)?.email ?? null;
    }
  }
  if (!email) throw new Error('github: no verified email');
  return { sub: String(ghUser.id), email: email.toLowerCase(), name: ghUser.name || ghUser.login };
}

/**
 * Finds the user for this OAuth identity, linking by verified email when the
 * account already exists, or creates a fresh one. Returns the user id, or
 * null when the matched account is blocked.
 */
export async function upsertOAuthUser(
  db: D1Database,
  provider: OAuthProvider,
  profile: OAuthProfile
): Promise<number | null> {
  const bySub = await db
    .prepare('SELECT id, blocked FROM users WHERE oauth_provider = ? AND oauth_sub = ?')
    .bind(provider, profile.sub)
    .first<{ id: number; blocked: number }>();
  if (bySub) return bySub.blocked ? null : bySub.id;

  const byEmail = await db
    .prepare('SELECT id, blocked, oauth_provider FROM users WHERE email = ?')
    .bind(profile.email)
    .first<{ id: number; blocked: number; oauth_provider: string | null }>();
  if (byEmail) {
    if (byEmail.blocked) return null;
    if (!byEmail.oauth_provider) {
      await db
        .prepare('UPDATE users SET oauth_provider = ?, oauth_sub = ? WHERE id = ?')
        .bind(provider, profile.sub, byEmail.id)
        .run();
    }
    return byEmail.id;
  }

  const base = slugify(profile.name, 30).replace(/-/g, '') || 'user';
  const username = await uniqueUsername(db, base);
  const created = await db
    .prepare('INSERT INTO users (email, username, name, oauth_provider, oauth_sub) VALUES (?, ?, ?, ?, ?) RETURNING id')
    .bind(profile.email, username, profile.name.slice(0, 80), provider, profile.sub)
    .first<{ id: number }>();
  return created?.id ?? null;
}
