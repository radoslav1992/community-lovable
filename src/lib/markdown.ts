// A small dependency-free Markdown subset for user-written content (comments).
// Everything is escaped before any tag is produced, so the result is always
// safe to inject with `set:html` — no HTML from the author survives.
//
// The same module runs in the browser for the live preview and the paste
// handler, so keep it free of server-only imports.

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ESCAPES[c]!);
}

/** Only http(s), mailto and site-relative links survive — never `javascript:`. */
function safeUrl(raw: string): string | null {
  const url = raw.trim();
  if (/^https?:\/\/\S+$/i.test(url)) return url;
  if (/^mailto:\S+$/i.test(url)) return url;
  if (/^www\.\S+$/i.test(url)) return `https://${url}`;
  if (/^\/(?!\/)\S*$/.test(url)) return url;
  return null;
}

const LINK_ATTRS = 'rel="nofollow ugc noopener" target="_blank"';

// Placeholder for already-rendered inline fragments (code spans, links) so that
// later passes cannot re-process their contents.
const HOLD = '\u0000';
const HOLD_RE = /\u0000(\d+)\u0000/g;

/** Inline markup, applied to a single logical line of raw (unescaped) text. */
function inline(raw: string): string {
  const held: string[] = [];
  const hold = (html: string) => `${HOLD}${held.push(html) - 1}${HOLD}`;

  let text = escapeHtml(raw.split(HOLD).join(''));

  // `code` — held aside so its contents keep every literal character.
  text = text.replace(/`([^`\n]+)`/g, (_m, code: string) => hold(`<code>${code}</code>`));

  // [label](https://example.com)
  text = text.replace(/\[([^\]\n]*)\]\(([^)\s]+)\)/g, (match, label: string, href: string) => {
    const url = safeUrl(href);
    if (!url) return match;
    return hold(`<a href="${url}" ${LINK_ATTRS}>${label || url}</a>`);
  });

  // Bare URLs, so a pasted link is clickable without Markdown syntax.
  text = text.replace(
    /(^|[\s(])((?:https?:\/\/|www\.)[^\s<]*[^\s<.,;:!?)\]])/gi,
    (match, lead: string, target: string) => {
      const url = safeUrl(target);
      if (!url) return match;
      return `${lead}${hold(`<a href="${url}" ${LINK_ATTRS}>${target}</a>`)}`;
    }
  );

  text = text.replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/(^|[^\w])__(?=\S)([\s\S]*?\S)__/g, '$1<strong>$2</strong>');
  text = text.replace(/(^|[^*\w])\*(?=\S)([^*\n]*?\S)\*/g, '$1<em>$2</em>');
  text = text.replace(/(^|[^_\w])_(?=\S)([^_\n]*?\S)_/g, '$1<em>$2</em>');
  text = text.replace(/~~(?=\S)([\s\S]*?\S)~~/g, '<del>$1</del>');

  return text.replace(HOLD_RE, (_m, index: string) => held[Number(index)]!);
}

const FENCE_RE = /^\s*```/;
const HEADING_RE = /^(#{1,6})\s+(.*)$/;
const RULE_RE = /^\s*([-*_])(?:\s*\1){2,}\s*$/;
const QUOTE_RE = /^\s*>/;
const BULLET_RE = /^\s*[-*+]\s+/;
const NUMBER_RE = /^\s*\d+[.)]\s+/;

function startsBlock(line: string): boolean {
  return (
    FENCE_RE.test(line) ||
    HEADING_RE.test(line) ||
    RULE_RE.test(line) ||
    QUOTE_RE.test(line) ||
    BULLET_RE.test(line) ||
    NUMBER_RE.test(line)
  );
}

/** Renders the supported Markdown subset to safe HTML. */
export function renderMarkdown(source: string): string {
  const lines = String(source ?? '').replace(/\r\n?/g, '\n').split('\n');
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;

    if (!line.trim()) {
      i++;
      continue;
    }

    if (FENCE_RE.test(line)) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !FENCE_RE.test(lines[i]!)) code.push(lines[i++]!);
      i++; // closing fence (or end of input)
      out.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`);
      continue;
    }

    if (RULE_RE.test(line)) {
      out.push('<hr />');
      i++;
      continue;
    }

    const heading = HEADING_RE.exec(line);
    if (heading) {
      // Comments live under the page's own h1/h2, so shift levels down.
      const level = Math.min(heading[1]!.length + 2, 6);
      out.push(`<h${level}>${inline(heading[2]!.trim())}</h${level}>`);
      i++;
      continue;
    }

    if (QUOTE_RE.test(line)) {
      const quoted: string[] = [];
      while (i < lines.length && QUOTE_RE.test(lines[i]!)) quoted.push(lines[i++]!.replace(/^\s*>\s?/, ''));
      out.push(`<blockquote>${renderMarkdown(quoted.join('\n'))}</blockquote>`);
      continue;
    }

    if (BULLET_RE.test(line)) {
      const items: string[] = [];
      while (i < lines.length && BULLET_RE.test(lines[i]!)) items.push(lines[i++]!.replace(BULLET_RE, ''));
      out.push(`<ul>${items.map((item) => `<li>${inline(item)}</li>`).join('')}</ul>`);
      continue;
    }

    if (NUMBER_RE.test(line)) {
      const items: string[] = [];
      while (i < lines.length && NUMBER_RE.test(lines[i]!)) items.push(lines[i++]!.replace(NUMBER_RE, ''));
      out.push(`<ol>${items.map((item) => `<li>${inline(item)}</li>`).join('')}</ol>`);
      continue;
    }

    const paragraph: string[] = [];
    while (i < lines.length && lines[i]!.trim() && !startsBlock(lines[i]!)) paragraph.push(lines[i++]!);
    out.push(`<p>${paragraph.map(inline).join('<br />')}</p>`);
  }

  return out.join('\n');
}

/** Markdown stripped back to readable plain text (search snippets, JSON-LD). */
export function plainText(source: string): string {
  return String(source ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/```[\s\S]*?(?:```|$)/g, ' ')
    .replace(/`([^`\n]+)`/g, '$1')
    .replace(/!?\[([^\]\n]*)\]\(([^)\s]+)\)/g, (_m, label: string, href: string) => label || href)
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '• ')
    .replace(/(\*\*|__|~~)(\S[\s\S]*?\S)\1/g, '$2')
    .replace(/(^|[^*\w])\*(\S[^*\n]*?\S)\*/g, '$1$2')
    .replace(/(^|[^_\w])_(\S[^_\n]*?\S)_/g, '$1$2')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}
