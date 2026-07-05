// Lovable Vibe Coding badge levels: verification against a public certificate
// URL (LinkedIn certification or lovable.dev share page) and periodic re-sync.

export interface LovableLevelInfo {
  label: string;
  name: string;
  style: string;
}

export const LOVABLE_LEVELS: Record<number, LovableLevelInfo> = {
  1: { label: 'L1 · Бронз', name: 'Bronze', style: 'background:#F1E0CC;color:#8A5A20' },
  2: { label: 'L2 · Сребро', name: 'Silver', style: 'background:#E8E8EC;color:#5C6270' },
  3: { label: 'L3 · Злато', name: 'Gold', style: 'background:#FFECC9;color:#A66300' },
  4: { label: 'L4 · Платина', name: 'Platinum', style: 'background:#DFF3F0;color:#0E7A6E' },
  5: { label: 'L5 · Диамант', name: 'Diamond', style: 'background:#E3E6FF;color:#3D53D6' },
};

const ALLOWED_HOSTS = ['linkedin.com', 'lovable.dev', 'lovable.app'];

/** Re-check URL-verified badges this often. */
const SYNC_INTERVAL_DAYS = 7;

const LEVEL_BY_NAME: Record<string, number> = {
  bronze: 1,
  silver: 2,
  gold: 3,
  platinum: 4,
  diamond: 5,
};

/**
 * Normalizes a certificate URL so the same certificate always maps to the
 * same stored string (uniqueness check), stripping tracking params and
 * fragments. Returns null when the URL is not a supported host.
 */
export function normalizeBadgeUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  const allowed = ALLOWED_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  if (!allowed) return null;
  const path = url.pathname.replace(/\/+$/, '');
  if (!path) return null;
  return `https://${host}${path}`;
}

/**
 * Extracts the Vibe Coding level (1–5) from certificate page HTML.
 * Returns 0 when the page doesn't look like a Vibe Coding certificate.
 */
export function parseLevelFromHtml(html: string): number {
  if (!/vibe[\s-]*coding/i.test(html)) return 0;
  let level = 0;
  // "L2: Silver", "L2 - Silver Vibe Coding"
  for (const m of html.matchAll(/\bL([1-5])\b[^a-z0-9]{0,10}(bronze|silver|gold|platinum|diamond)/gi)) {
    level = Math.max(level, parseInt(m[1]!, 10));
  }
  // "Silver Vibe Coding badge"
  for (const m of html.matchAll(/(bronze|silver|gold|platinum|diamond)[^a-z0-9]{0,12}vibe[\s-]*coding/gi)) {
    level = Math.max(level, LEVEL_BY_NAME[m[1]!.toLowerCase()] ?? 0);
  }
  // "Vibe Coding Level 3"
  for (const m of html.matchAll(/vibe[\s-]*coding[^a-z0-9]{0,12}level[^0-9]{0,4}([1-5])/gi)) {
    level = Math.max(level, parseInt(m[1]!, 10));
  }
  return level;
}

/** Fetches a certificate page and returns the parsed level, or 0 on failure. */
export async function fetchBadgeLevel(url: string): Promise<number> {
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
    if (!res.ok) return 0;
    const html = (await res.text()).slice(0, 1_500_000);
    return parseLevelFromHtml(html);
  } catch {
    return 0;
  }
}

/**
 * Re-fetches a stored certificate URL and updates the user's level. Keeps the
 * previous level when the page can't be fetched or parsed (never downgrades on
 * a transient failure), but always records the sync attempt.
 */
export async function resyncBadge(db: D1Database, userId: number, badgeUrl: string): Promise<void> {
  const level = await fetchBadgeLevel(badgeUrl);
  if (level > 0) {
    await db
      .prepare("UPDATE users SET lovable_level = ?, lovable_synced_at = datetime('now') WHERE id = ?")
      .bind(level, userId)
      .run();
  } else {
    await db.prepare("UPDATE users SET lovable_synced_at = datetime('now') WHERE id = ?").bind(userId).run();
  }
}

interface BadgeHolder {
  id: number;
  lovable_verified_via: string | null;
  lovable_badge_url: string | null;
  lovable_synced_at: string | null;
}

/** Schedules a background re-sync when a URL-verified badge has gone stale. */
export function maybeResyncBadge(
  db: D1Database,
  person: BadgeHolder,
  waitUntil: (p: Promise<unknown>) => void
): void {
  if (person.lovable_verified_via !== 'url' || !person.lovable_badge_url) return;
  const synced = person.lovable_synced_at ? new Date(person.lovable_synced_at.replace(' ', 'T') + 'Z') : null;
  const stale = !synced || Date.now() - synced.getTime() > SYNC_INTERVAL_DAYS * 24 * 3600 * 1000;
  if (!stale) return;
  waitUntil(resyncBadge(db, person.id, person.lovable_badge_url).catch(() => {}));
}
