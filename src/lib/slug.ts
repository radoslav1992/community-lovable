// Bulgarian → Latin transliteration (official streamlined system) for SEO-friendly URLs.
const MAP: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y',
  к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u',
  ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sht', ъ: 'a', ь: 'y', ю: 'yu', я: 'ya',
};

export function transliterate(text: string): string {
  return [...text.toLowerCase()].map((ch) => MAP[ch] ?? ch).join('');
}

export function slugify(title: string, maxLength = 80): string {
  const slug = transliterate(title)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength)
    .replace(/-+$/g, '');
  return slug || 'post';
}

/** Returns `base`, or `base-2`, `base-3`, … — first variant not present in `table`.`column`. */
export async function uniqueSlug(db: D1Database, table: 'posts' | 'events' | 'news', base: string): Promise<string> {
  const existing = await db
    .prepare(`SELECT slug FROM ${table} WHERE slug = ? OR slug LIKE ?`)
    .bind(base, `${base}-%`)
    .all<{ slug: string }>();
  const taken = new Set(existing.results.map((r) => r.slug));
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) {
    const candidate = `${base}-${i}`;
    if (!taken.has(candidate)) return candidate;
  }
}
