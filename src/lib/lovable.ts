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

export interface LovableStats {
  followers?: number;
  following?: number;
  daysActive?: number;
  streakDays?: number;
  dailyAvg?: number;
}

export interface ParsedProfile {
  topPercent: number | null;
  badges: string[];
  edits: number | null;
  stats: LovableStats;
}

function firstInt(text: string, patterns: RegExp[]): number | null {
  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      const n = parseInt(m[1]!.replace(/,/g, ''), 10);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

/**
 * Extracts public data from a profile page: the yearly edit count and
 * activity stats from the activity panel, plus any "Top N% of Lovable users"
 * badge should Lovable ever publish it. Works on both rendered DOM and
 * framework payloads (JSON-escaped strings inside scripts), so a
 * server-rendered page and a hydration payload both parse.
 */
export function parseProfileBadges(html: string): ParsedProfile {
  let topPercent: number | null = null;
  for (const m of html.matchAll(/top\s*(\d{1,2})\s*%\s*of\s*(?:all\s*)?lovable\s*users/gi)) {
    const n = parseInt(m[1]!, 10);
    if (n > 0 && (topPercent === null || n < topPercent)) topPercent = n;
  }
  const badges: string[] = [];
  if (topPercent !== null) badges.push(`Top ${topPercent}% of Lovable users`);

  // Values are split across tags (or across JSON string chunks in a script
  // payload) — unescape, then strip tags, then match with small gaps.
  const text = html
    .replace(/\\["nrt]/g, (s) => (s === '\\"' ? '"' : ' '))
    .replace(/<[^>]+>/g, ' ');

  let edits: number | null = null;
  const candidates = [
    // Rendered DOM: label and value adjacent after tag-stripping.
    ...text.matchAll(/total[\s_]*edits\D{0,20}?(\d[\d,]*)/gi),
    // Flight payload: the value is its own children:"…" string node near
    // the label (a small gap would match React keys like "1" instead).
    ...text.matchAll(/total[\s_]*edits[\s\S]{0,200}?children":"(\d[\d,]*)"/gi),
    ...text.matchAll(/"totalEdits"\s*[:,]\s*"?(\d[\d,]*)/gi),
    // "2869 edits on … in the last year"; the lookbehind skips the decimal
    // "7.9 edits" daily average.
    ...text.matchAll(/(?<![\d.,])(\d[\d,]*)\s+edits\s+on\b/gi),
  ];
  for (const m of candidates) {
    const n = parseInt(m[1]!.replace(/,/g, ''), 10);
    if (Number.isFinite(n) && (edits === null || n > edits)) edits = n;
  }

  // Unit-anchored patterns ("229 days", "7.9 edits") stay unambiguous even
  // across flight framing, since each value+unit is a single string node.
  const stats: LovableStats = {};
  const followers = firstInt(text, [/(\d[\d,]*)\s*followers/i, /"followers?(?:Count)?"\s*[:,]\s*"?(\d[\d,]*)/i]);
  const following = firstInt(text, [/(\d[\d,]*)\s*following/i, /"following(?:Count)?"\s*[:,]\s*"?(\d[\d,]*)/i]);
  const daysActive = firstInt(text, [
    /days\s*active[\s\S]{0,160}?(\d[\d,]*)\s*days/i,
    /"daysActive"\s*[:,]\s*"?(\d[\d,]*)/i,
  ]);
  const streakDays = firstInt(text, [
    /current\s*streak[\s\S]{0,160}?(\d[\d,]*)\s*days/i,
    /"(?:currentStreak|streak)"\s*[:,]\s*"?(\d[\d,]*)/i,
  ]);
  const dailyAvgM = text.match(/daily\s*average[\s\S]{0,160}?(\d[\d,]*(?:\.\d+)?)\s*edits/i);
  if (followers !== null) stats.followers = followers;
  if (following !== null) stats.following = following;
  if (daysActive !== null) stats.daysActive = daysActive;
  if (streakDays !== null) stats.streakDays = streakDays;
  if (dailyAvgM) {
    const avg = parseFloat(dailyAvgM[1]!.replace(/,/g, ''));
    if (Number.isFinite(avg)) stats.dailyAvg = avg;
  }

  return { topPercent, badges, edits, stats };
}

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

/** Fetches a profile page's HTML, or null when unreachable/private. */
export async function fetchProfileHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(10_000),
      headers: {
        'User-Agent': BROWSER_UA,
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
 * Fetches the page's server-component (flight) payload — the channel that
 * can carry data deferred out of the initial HTML. Null when unavailable.
 */
export async function fetchProfileRsc(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(10_000),
      headers: {
        'User-Agent': BROWSER_UA,
        Accept: 'text/x-component, */*',
        RSC: '1',
      },
    });
    if (!res.ok) return null;
    return (await res.text()).slice(0, 2_000_000);
  } catch {
    return null;
  }
}

const API_BASE = 'https://api.lovable.dev';

export interface LovableApiProfile {
  id: string;
  username: string;
  bio: string;
  followers: number | null;
  following: number | null;
}

/** Public profile from Lovable's Go API (confirmed: GET /profile/{username}). */
export async function fetchApiProfile(username: string): Promise<LovableApiProfile | null> {
  try {
    const res = await fetch(`${API_BASE}/profile/${encodeURIComponent(username)}`, {
      signal: AbortSignal.timeout(10_000),
      headers: { 'User-Agent': BROWSER_UA, Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const j = (await res.json()) as any;
    if (!j || typeof j !== 'object' || !j.id) return null;
    return {
      id: String(j.id),
      username: String(j.username ?? username),
      bio: String(j.attributes?.bio ?? ''),
      followers: typeof j.followers_count === 'number' ? j.followers_count : null,
      following: typeof j.following_count === 'number' ? j.following_count : null,
    };
  } catch {
    return null;
  }
}

/** A daily-contributions map: "yyyy-MM-dd" -> edit count. */
function extractDailyMap(j: unknown): Record<string, number> | null {
  for (const c of [j, (j as any)?.contributions, (j as any)?.data, (j as any)?.days]) {
    if (!c || typeof c !== 'object' || Array.isArray(c)) continue;
    const keys = Object.keys(c);
    if (
      keys.every((k) => /^\d{4}-\d{2}-\d{2}$/.test(k)) &&
      keys.every((k) => typeof (c as Record<string, unknown>)[k] === 'number')
    ) {
      return c as Record<string, number>;
    }
  }
  return null;
}

/** Contribution-endpoint shapes to try, most likely first. */
export function contributionPaths(id: string, username: string): string[] {
  return [
    `/user/${id}/contributions`,
    `/users/${id}/contributions`,
    `/profile/${encodeURIComponent(username)}/contributions`,
    `/user/${id}/activity`,
    `/contributions/${id}`,
  ];
}

/** Fetches the daily edit-count map, trying the endpoint shapes in order. */
export async function fetchContributions(id: string, username: string): Promise<Record<string, number> | null> {
  for (const p of contributionPaths(id, username)) {
    try {
      const res = await fetch(API_BASE + p, {
        signal: AbortSignal.timeout(6_000),
        headers: { 'User-Agent': BROWSER_UA, Accept: 'application/json' },
      });
      if (!res.ok) continue;
      const map = extractDailyMap(await res.json());
      if (map !== null) return map;
    } catch {
      // try the next shape
    }
  }
  return null;
}

/**
 * Derives the activity stats from the daily map the same way Lovable's own
 * profile component does: sum/count over the trailing 365 days, streak
 * walking back from today, average over 365.
 */
export function computeActivity(map: Record<string, number>): {
  edits: number;
  daysActive: number;
  streakDays: number;
  dailyAvg: number;
} {
  const DAY = 86_400_000;
  const today = Date.now();
  let edits = 0;
  let daysActive = 0;
  const counts: number[] = [];
  for (let i = 364; i >= 0; i--) {
    const key = new Date(today - i * DAY).toISOString().slice(0, 10);
    const n = map[key] ?? 0;
    counts.push(n);
    edits += n;
    if (n > 0) daysActive++;
  }
  let streakDays = 0;
  for (let i = counts.length - 1; i >= 0 && counts[i]! > 0; i--) streakDays++;
  const dailyAvg = Math.round((edits / 365) * 10) / 10;
  return { edits, daysActive, streakDays, dailyAvg };
}

/**
 * Fetches and parses a profile. Primary source is the public Go API
 * (profile body for the bio/verification, contributions for the activity
 * stats); the HTML page + flight payload remain as fallback. `html` carries
 * the text the ownership code is checked against (API bio, or page HTML).
 */
export async function fetchAndParseProfile(
  url: string
): Promise<{ html: string | null; parsed: ParsedProfile | null }> {
  const username = url.match(/\/@([^/]+)/)?.[1];
  if (username) {
    const api = await fetchApiProfile(username);
    if (api) {
      const stats: LovableStats = {};
      if (api.followers !== null) stats.followers = api.followers;
      if (api.following !== null) stats.following = api.following;
      let edits: number | null = null;
      const contrib = await fetchContributions(api.id, api.username);
      if (contrib !== null) {
        const a = computeActivity(contrib);
        edits = a.edits;
        stats.daysActive = a.daysActive;
        stats.streakDays = a.streakDays;
        stats.dailyAvg = a.dailyAvg;
      }
      return { html: api.bio, parsed: { topPercent: null, badges: [], edits, stats } };
    }
  }

  const html = await fetchProfileHtml(url);
  if (html === null) return { html: null, parsed: null };
  let parsed = parseProfileBadges(html);
  if (parsed.edits === null) {
    const rsc = await fetchProfileRsc(url);
    if (rsc !== null) parsed = parseProfileBadges(html + '\n' + rsc);
  }
  return { html, parsed };
}

/**
 * Re-fetches a verified profile and updates the stored badges. Keeps the
 * previous badges when the page can't be fetched (e.g. temporarily private) —
 * never downgrades on a transient failure — but always records the attempt.
 */
export async function resyncBadges(db: D1Database, userId: number, profileUrl: string): Promise<void> {
  const { html, parsed } = await fetchAndParseProfile(profileUrl);
  if (html !== null && parsed !== null) {
    await db
      .prepare(
        `UPDATE users SET lovable_top_percent = ?, lovable_badges = ?, lovable_edits = ?,
           lovable_stats = ?, lovable_synced_at = datetime('now') WHERE id = ?`
      )
      .bind(parsed.topPercent, JSON.stringify(parsed.badges), parsed.edits, JSON.stringify(parsed.stats), userId)
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
