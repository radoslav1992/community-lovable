// Публичен showcase на проекти, направени с Lovable (/proekti).

export const PROJECT_CATEGORY_STYLES: Record<string, string> = {
  'Инструмент': 'background:#DCE9FF;color:#2456C9',
  'SaaS': 'background:#E3E6FF;color:#3D53D6',
  'Магазин': 'background:#FFE4D3;color:#C24E00',
  'Портфолио': 'background:#FFE0F1;color:#C4005D',
  'Игра': 'background:#FFECC9;color:#A66300',
  'AI': 'background:#E6F0D8;color:#4A6B18',
  'Друго': 'background:#EDE9DE;color:#6E695E',
};

export const PROJECT_CATEGORIES = Object.keys(PROJECT_CATEGORY_STYLES);

export function categoryStyle(category: string): string {
  return PROJECT_CATEGORY_STYLES[category] ?? PROJECT_CATEGORY_STYLES['Друго']!;
}

/** Хостове, при които проектът е публикуван директно от Lovable. */
const LOVABLE_HOSTS = /(^|\.)(lovable\.app|lovableproject\.com|lovable\.dev)$/;

/** Дали адресът е публикуван на домейн на Lovable (а не на собствен домейн). */
export function isLovableUrl(url: string): boolean {
  try {
    return LOVABLE_HOSTS.test(new URL(url).hostname.toLowerCase());
  } catch {
    return false;
  }
}

/**
 * Приема адрес със или без схема ("free-website-analyzer.lovable.app") и го
 * нормализира до канонично https URL без завършваща наклонена черта.
 * Връща null, ако адресът не е публичен http(s) адрес.
 */
export function normalizeProjectUrl(raw: string): string | null {
  const s = raw.trim();
  if (!s || s.length > 300) return null;

  let url: URL;
  try {
    url = new URL(/^[a-z]+:\/\//i.test(s) ? s : `https://${s}`);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;

  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  // Изисква публично име: точка в хоста, без localhost и без голи IP адреси.
  if (!host.includes('.') || host === 'localhost') return null;
  if (/^[\d.]+$/.test(host) || host.includes(':')) return null;

  // Всички Lovable деплойменти са https; вдигаме и останалите за единен вид.
  url.protocol = 'https:';
  url.hostname = host;
  url.hash = '';
  const path = url.pathname.replace(/\/+$/, '');
  return `https://${host}${path}${url.search}`;
}

/**
 * Линк за ремикс — приема се само адрес в lovable.dev, защото само там
 * ремиксът е реален. Връща null при всичко останало.
 */
export function normalizeRemixUrl(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  const url = normalizeProjectUrl(s);
  if (!url) return null;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === 'lovable.dev' ? url : null;
  } catch {
    return null;
  }
}

const MAX_TAGS = 4;

/** "SEO, Производителност" → ["SEO", "Производителност"]; чисти празни и дълги. */
export function parseTags(raw: string): string[] {
  const seen = new Set<string>();
  for (const part of raw.split(/[,;]/)) {
    const tag = part.trim().replace(/\s+/g, ' ').slice(0, 24);
    if (tag) seen.add(tag);
    if (seen.size >= MAX_TAGS) break;
  }
  return [...seen];
}

/** Кратък вид на адреса за карта на проекта: "free-website-analyzer.lovable.app". */
export function displayUrl(url: string): string {
  try {
    const u = new URL(url);
    return (u.hostname + u.pathname.replace(/\/+$/, '')).replace(/^www\./, '');
  } catch {
    return url;
  }
}

const THUMB_GRADIENTS = [
  'linear-gradient(135deg,#FF6D1B,#FF0178)',
  'linear-gradient(135deg,#4B73FF,#FFA6F9)',
  'linear-gradient(135deg,#FF0178,#4B73FF)',
  'linear-gradient(135deg,#FFA517,#F7101D)',
  'linear-gradient(135deg,#4B73FF,#17B0A0)',
];

export function projectGradient(seed: number): string {
  return THUMB_GRADIENTS[Math.abs(seed) % THUMB_GRADIENTS.length]!;
}

/** Първата буква на заглавието — монограм за плочката на проекта. */
export function projectMonogram(title: string): string {
  return (title.trim()[0] ?? '?').toUpperCase();
}
