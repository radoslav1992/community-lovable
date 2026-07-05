import type { AstroCookies } from 'astro';

export interface SessionUser {
  id: number;
  email: string;
  username: string;
  name: string;
  bio: string;
  role: 'member' | 'moderator' | 'admin';
  blocked: number;
  notif_email: number;
  notif_digest: number;
  public_profile: number;
  lovable_profile_url: string | null;
  lovable_username: string | null;
  lovable_top_percent: number | null;
  lovable_badges: string;
  lovable_synced_at: string | null;
  created_at: string;
}

const PBKDF2_ITERATIONS = 100_000;
const SESSION_DAYS = 30;
export const SESSION_COOKIE = 'session';

const enc = new TextEncoder();

function toBase64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function fromBase64(s: string): Uint8Array {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

async function pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  return crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
    key,
    256
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const bits = await pbkdf2(password, salt, PBKDF2_ITERATIONS);
  return `${PBKDF2_ITERATIONS}:${toBase64(salt.buffer as ArrayBuffer)}:${toBase64(bits)}`;
}

export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  if (!stored) return false;
  const [iterStr, saltB64, hashB64] = stored.split(':');
  if (!iterStr || !saltB64 || !hashB64) return false;
  const bits = await pbkdf2(password, fromBase64(saltB64), parseInt(iterStr, 10));
  const a = new Uint8Array(bits);
  const b = fromBase64(hashB64);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

function generateToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function createSession(db: D1Database, userId: number): Promise<{ token: string; expires: Date }> {
  const token = generateToken();
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 3600 * 1000);
  await db
    .prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)')
    .bind(token, userId, expires.toISOString().slice(0, 19).replace('T', ' '))
    .run();
  return { token, expires };
}

export async function getSessionUser(db: D1Database, token: string): Promise<SessionUser | null> {
  const row = await db
    .prepare(
      `SELECT u.id, u.email, u.username, u.name, u.bio, u.role, u.blocked,
              u.notif_email, u.notif_digest, u.public_profile,
              u.lovable_profile_url, u.lovable_username, u.lovable_top_percent, u.lovable_badges, u.lovable_synced_at,
              u.created_at
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token = ? AND s.expires_at > datetime('now')`
    )
    .bind(token)
    .first<SessionUser>();
  return row ?? null;
}

export async function deleteSession(db: D1Database, token: string): Promise<void> {
  await db.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
}

/** Derives a unique latin username from a display name. */
export async function uniqueUsername(db: D1Database, base: string): Promise<string> {
  let username = base || 'user';
  for (let i = 2; ; i++) {
    const taken = await db.prepare('SELECT 1 FROM users WHERE username = ?').bind(username).first();
    if (!taken) return username;
    username = `${base}${i}`;
  }
}

export function setSessionCookie(cookies: AstroCookies, token: string, expires: Date): void {
  cookies.set(SESSION_COOKIE, token, {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    expires,
  });
}

export function clearSessionCookie(cookies: AstroCookies): void {
  cookies.delete(SESSION_COOKIE, { path: '/' });
}
