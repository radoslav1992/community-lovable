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
  edits: number | null;
}

/**
 * Extracts public data from a profile page: the yearly edit count from the
 * activity panel ("Total Edits 2,869" / "2869 edits on … in the last year"),
 * and any "Top N% of Lovable users" badge should Lovable ever publish it.
 */
export function parseProfileBadges(html: string): ParsedProfile {
  let topPercent: number | null = null;
  for (const m of html.matchAll(/top\s*(\d{1,2})\s*%\s*of\s*(?:all\s*)?lovable\s*users/gi)) {
    const n = parseInt(m[1]!, 10);
    if (n > 0 && (topPercent === null || n < topPercent)) topPercent = n;
  }
  const badges: string[] = [];
  if (topPercent !== null) badges.push(`Top ${topPercent}% of Lovable users`);

  // The stats are split across tags — compare against the tag-stripped text.
  const text = html.replace(/<[^>]+>/g, ' ');
  let edits: number | null = null;
  const candidates = [
    ...text.matchAll(/total\s*edits\D{0,20}?(\d[\d,]*)/gi),
    // "2869 edits on … in the last year"; the lookbehind skips the decimal
    // "7.9 edits" daily average.
    ...text.matchAll(/(?<![\d.,])(\d[\d,]*)\s+edits\s+on\b/gi),
  ];
  for (const m of candidates) {
    const n = parseInt(m[1]!.replace(/,/g, ''), 10);
    if (Number.isFinite(n) && (edits === null || n > edits)) edits = n;
  }

  return { topPercent, badges, edits };
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
        `UPDATE users SET lovable_top_percent = ?, lovable_badges = ?, lovable_edits = ?,
           lovable_synced_at = datetime('now') WHERE id = ?`
      )
      .bind(parsed.topPercent, JSON.stringify(parsed.badges), parsed.edits, userId)
      .run();
  } else {
    await db.prepare("UPDATE users SET lovable_synced_at = datetime('now') WHERE id = ?").bind(userId).run();
  }
}

export interface LovableTier {
  key: string;
  label: string;
  min: number;
  style: string;
}

/** Community tiers by yearly Lovable edits, ordered highest first. */
export const LOVABLE_TIERS: LovableTier[] = [
  { key: 'diamond', label: 'Диамант', min: 10_000, style: 'background:#E3E6FF;color:#3D53D6' },
  { key: 'platinum', label: 'Платина', min: 5_000, style: 'background:#DFF3F0;color:#0E7A6E' },
  { key: 'gold', label: 'Злато', min: 2_000, style: 'background:#FFECC9;color:#A66300' },
  { key: 'silver', label: 'Сребро', min: 500, style: 'background:#E8E8EC;color:#5C6270' },
  { key: 'bronze', label: 'Бронз', min: 0, style: 'background:#F1E0CC;color:#8A5A20' },
];

export function lovableTier(edits: number | null | undefined): LovableTier | null {
  if (edits === null || edits === undefined) return null;
  return LOVABLE_TIERS.find((t) => edits >= t.min) ?? null;
}

/** The tier above the current one, or null when already at Diamond. */
export function nextLovableTier(edits: number | null | undefined): LovableTier | null {
  if (edits === null || edits === undefined) return null;
  return [...LOVABLE_TIERS].reverse().find((t) => t.min > edits) ?? null;
}

/**
 * SQL fragment for author queries joining `users u`: whether the author has a
 * verified Lovable profile, their yearly edits, and their community rank
 * (1 = most edits among verified members; NULL when unverified or unknown).
 */
export const AUTHOR_LOVABLE_SQL = `
  u.lovable_profile_url IS NOT NULL AS author_lovable,
  u.lovable_edits AS author_lovable_edits,
  CASE WHEN u.lovable_profile_url IS NULL OR u.lovable_edits IS NULL THEN NULL ELSE
    (SELECT COUNT(*) + 1 FROM users ur
     WHERE ur.lovable_profile_url IS NOT NULL AND ur.lovable_edits > u.lovable_edits)
  END AS author_lovable_rank`;

/** Community rank for a single member (see AUTHOR_LOVABLE_SQL). */
export async function lovableRank(
  db: D1Database,
  person: { lovable_profile_url: string | null; lovable_edits: number | null }
): Promise<number | null> {
  if (!person.lovable_profile_url || person.lovable_edits === null) return null;
  const row = await db
    .prepare(
      'SELECT COUNT(*) + 1 AS r FROM users WHERE lovable_profile_url IS NOT NULL AND lovable_edits > ?'
    )
    .bind(person.lovable_edits)
    .first<{ r: number }>();
  return row?.r ?? null;
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
