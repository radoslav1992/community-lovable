// Bulgarian-language date/time formatting and shared visual tokens.

const MONTHS = [
  'януари', 'февруари', 'март', 'април', 'май', 'юни',
  'юли', 'август', 'септември', 'октомври', 'ноември', 'декември',
];

const MONTHS_ABBR = [
  'ЯНУ', 'ФЕВ', 'МАРТ', 'АПР', 'МАЙ', 'ЮНИ', 'ЮЛИ', 'АВГ', 'СЕПТ', 'ОКТ', 'НОЕМ', 'ДЕК',
];

/** SQLite `datetime('now')` strings are UTC without a timezone marker. */
export function parseDbDate(value: string): Date {
  if (value.includes('T')) return new Date(value);
  return new Date(value.replace(' ', 'T') + 'Z');
}

export function timeAgo(value: string, now: Date = new Date()): string {
  const date = parseDbDate(value);
  const diffMin = Math.floor((now.getTime() - date.getTime()) / 60_000);
  if (diffMin < 1) return 'току-що';
  if (diffMin < 60) return `преди ${diffMin} мин`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return diffH === 1 ? 'преди 1 час' : `преди ${diffH} часа`;
  const diffD = Math.floor(diffH / 24);
  if (diffD === 1) return 'вчера';
  if (diffD < 7) return `преди ${diffD} дни`;
  const diffW = Math.floor(diffD / 7);
  if (diffW < 5) return diffW === 1 ? 'преди 1 седмица' : `преди ${diffW} седмици`;
  return bgDate(value);
}

export function bgDate(value: string): string {
  const d = parseDbDate(value);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function memberSince(value: string): string {
  const d = parseDbDate(value);
  return `член от ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function eventDayMonth(value: string): { day: string; month: string } {
  const d = parseDbDate(value);
  return { day: String(d.getUTCDate()).padStart(2, '0'), month: MONTHS_ABBR[d.getUTCMonth()]! };
}

export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export const TAG_STYLES: Record<string, string> = {
  'Дискусия': 'background:#E3E6FF;color:#3D53D6',
  'Помощ': 'background:#FFECC9;color:#A66300',
  'Ръководство': 'background:#DCE9FF;color:#2456C9',
  'Покажи': 'background:#FFE0F1;color:#C4005D',
  'Общност': 'background:#FFE4D3;color:#C24E00',
};

export const TAGS = Object.keys(TAG_STYLES);

export function tagStyle(tag: string): string {
  return TAG_STYLES[tag] ?? TAG_STYLES['Дискусия']!;
}

export const LEVEL_STYLES: Record<string, string> = {
  beginner: 'background:#DCE9FF;color:#2456C9',
  intermediate: 'background:#FFE0F1;color:#C4005D',
  advanced: 'background:#FFE4D3;color:#C24E00',
};

const AVATAR_GRADIENTS = [
  'linear-gradient(135deg,#FF6D1B,#FF0178)',
  'linear-gradient(135deg,#4B73FF,#FFA6F9)',
  'linear-gradient(135deg,#FF0178,#4B73FF)',
  'linear-gradient(135deg,#FFA517,#F7101D)',
];

export function avatarGradient(seed: number): string {
  return AVATAR_GRADIENTS[Math.abs(seed) % AVATAR_GRADIENTS.length]!;
}

export const USER_GRADIENT = 'linear-gradient(135deg,#FF6D1B,#FF0178,#4B73FF)';

export const ROLE_LABELS: Record<string, string> = {
  admin: 'Админ',
  moderator: 'Модератор',
  member: 'Член',
};

export const ROLE_STYLES: Record<string, string> = {
  admin: 'background:#FFE0F1;color:#C4005D',
  moderator: 'background:#DCE9FF;color:#2456C9',
  member: 'background:#EDE9DE;color:#6E695E',
};
