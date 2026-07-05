// Lovable profile badges: members claim their public lovable.dev/@username
// profile, prove ownership via a one-time code in the profile bio, and their
// public badges (e.g. "Top 10% of Lovable users") re-sync periodically.

/** Re-check verified profiles this often. */
const SYNC_INTERVAL_DAYS = 7;

export const CLAIM_TTL_HOURS = 24;

const USERNAME_RE = /^[a-z0-9_.-]{2,40}$/i;

export interface LovableProfileRef {
  url: string;
  username: string;
}

/**
 * Accepts a full profile URL ("https://lovable.dev/@ivan"), "@ivan" or a bare
 * username, and normalizes to the canonical profile URL. Returns null when
 * the input is neither.
 */
export function normalizeProfileUrl(raw: string): LovableProfileRef | null {
  const s = raw.trim();
  let username: string | null = null;

  const bare = s.replace(/^@/, '');
  if (USERNAME_RE.test(bare) && !bare.includes('..')) {
    username = bare;
  } else {
    try {
      // Tolerate a pasted URL without a scheme ("lovable.dev/@ivan").
      const u = new URL(/^[a-z]+:\/\//i.test(s) ? s : `https://${s}`);
      const host = u.hostname.toLowerCase().replace(/^www\./, '');
      if (host !== 'lovable.dev') return null;
      const m = u.pathname.replace(/\/+$/, '').match(/^\/@([^/]+)$/);
      if (!m || !USERNAME_RE.test(m[1]!)) return null;
      username = m[1]!;
    } catch {
      return null;
    }
  }

  username = username.toLowerCase();
  return { url: `https://lovable.dev/@${username}`, username };
}

export function generateClaimCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `CLBG-${hex.toUpperCase()}`;
}

export interface ParsedProfile {
  topPercent: number | null;
  badges: string[];
}

/**
 * Extracts public badges from a profile page. Currently recognizes the
 * "Top N% of Lovable users" badge; the pattern list is meant to grow as
 * Lovable ships more public skills/badges.
 */
export function parseProfileBadges(html: string): ParsedProfile {
  let topPercent: number | null = null;
  for (const m of html.matchAll(/top\s*(\d{1,2})\s*%\s*of\s*(?:all\s*)?lovable\s*users/gi)) {
    const n = parseInt(m[1]!, 10);
    if (n > 0 && (topPercent === null || n < topPercent)) topPercent = n;
  }
  const badges: string[] = [];
  if (topPercent !== null) badges.push(`Top ${topPercent}% of Lovable users`);
  return { topPercent, badges };
}

/** Fetches a profile page's HTML, or null when unreachable/private. */
export async function fetchProfileHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(10_000),
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'en,bg;q=0.8',
      },
    });
    if (!res.ok) return null;
    return (await res.text()).slice(0, 2_000_000);
  } catch {
    return null;
  }
}

/**
 * Re-fetches a verified profile and updates the stored badges. Keeps the
 * previous badges when the page can't be fetched (e.g. temporarily private) —
 * never downgrades on a transient failure — but always records the attempt.
 */
export async function resyncBadges(db: D1Database, userId: number, profileUrl: string): Promise<void> {
  const html = await fetchProfileHtml(profileUrl);
  if (html !== null) {
    const parsed = parseProfileBadges(html);
    await db
      .prepare(
        `UPDATE users SET lovable_top_percent = ?, lovable_badges = ?, lovable_synced_at = datetime('now')
         WHERE id = ?`
      )
      .bind(parsed.topPercent, JSON.stringify(parsed.badges), userId)
      .run();
  } else {
    await db.prepare("UPDATE users SET lovable_synced_at = datetime('now') WHERE id = ?").bind(userId).run();
  }
}

interface BadgeHolder {
  id: number;
  lovable_profile_url: string | null;
  lovable_synced_at: string | null;
}

/** Schedules a background badge re-sync when a verified profile has gone stale. */
export function maybeResyncBadges(
  db: D1Database,
  person: BadgeHolder,
  waitUntil: (p: Promise<unknown>) => void
): void {
  if (!person.lovable_profile_url) return;
  const synced = person.lovable_synced_at ? new Date(person.lovable_synced_at.replace(' ', 'T') + 'Z') : null;
  const stale = !synced || Date.now() - synced.getTime() > SYNC_INTERVAL_DAYS * 24 * 3600 * 1000;
  if (!stale) return;
  waitUntil(resyncBadges(db, person.id, person.lovable_profile_url).catch(() => {}));
}
