// Comment composer behaviour: formatting toolbar, live Markdown preview,
// rich-paste conversion (so pasted formatting survives instead of being
// flattened) and a confirmation step before a comment is deleted.
import { renderMarkdown } from '../lib/markdown';

/** Rich text often arrives full of non-breaking spaces. */
const NBSP = /\u00a0/g;

type Wrap = { before: string; after: string; sample: string };

const WRAPS: Record<string, Wrap> = {
  bold: { before: '**', after: '**', sample: 'удебелен текст' },
  italic: { before: '*', after: '*', sample: 'курсив' },
  code: { before: '`', after: '`', sample: 'код' },
};

const PREFIXES: Record<string, string> = {
  list: '- ',
  quote: '> ',
};

function textareaOf(el: Element): HTMLTextAreaElement | null {
  return el.closest('form')?.querySelector<HTMLTextAreaElement>('textarea[name="body"]') ?? null;
}

function replaceSelection(input: HTMLTextAreaElement, text: string, selectFrom: number, selectTo: number) {
  const { selectionStart, selectionEnd, value } = input;
  input.value = value.slice(0, selectionStart) + text + value.slice(selectionEnd);
  input.setSelectionRange(selectionStart + selectFrom, selectionStart + selectTo);
  input.focus();
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function applyWrap(input: HTMLTextAreaElement, wrap: Wrap) {
  const selected = input.value.slice(input.selectionStart, input.selectionEnd);
  // Markers must hug the text — `** bold **` is not bold.
  const [, lead = '', core = '', trail = ''] = /^(\s*)([\s\S]*?)(\s*)$/.exec(selected) ?? [];
  const inner = core || wrap.sample;
  const text = `${lead}${wrap.before}${inner}${wrap.after}${trail}`;
  const from = lead.length + wrap.before.length;
  replaceSelection(input, text, from, from + inner.length);
}

function applyPrefix(input: HTMLTextAreaElement, prefix: string) {
  const { value, selectionStart, selectionEnd } = input;
  const start = value.lastIndexOf('\n', selectionStart - 1) + 1;
  const endIndex = value.indexOf('\n', selectionEnd);
  const end = endIndex === -1 ? value.length : endIndex;
  const block = value.slice(start, end) || prefix.trim();
  const lines = block.split('\n');
  const stripped = lines.every((line) => line.startsWith(prefix));
  const next = lines
    .map((line) => (stripped ? line.slice(prefix.length) : `${prefix}${line}`))
    .join('\n');

  input.setSelectionRange(start, end);
  replaceSelection(input, next, 0, next.length);
}

function applyLink(input: HTMLTextAreaElement) {
  const selected = input.value.slice(input.selectionStart, input.selectionEnd);
  const isUrl = /^(https?:\/\/|www\.|mailto:)\S+$/i.test(selected.trim());
  const label = isUrl ? 'текст' : selected || 'текст';
  const url = isUrl ? selected.trim() : 'https://';
  const markdown = `[${label}](${url})`;
  // Put the caret on the part the author still has to fill in.
  const from = isUrl ? 1 : label.length + 3;
  const to = isUrl ? 1 + label.length : markdown.length - 1;
  replaceSelection(input, markdown, from, to);
}

/** Converts pasted HTML into the Markdown subset the comments understand. */
function htmlToMarkdown(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('script, style, noscript, head').forEach((el) => el.remove());

  const walk = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return (node.textContent ?? '').replace(/\s+/g, ' ');
    if (node.nodeType !== Node.ELEMENT_NODE) return '';

    const el = node as HTMLElement;
    const children = () => Array.from(el.childNodes).map(walk).join('');
    const tag = el.tagName.toLowerCase();

    switch (tag) {
      case 'br':
        return '\n';
      case 'hr':
        return '\n\n---\n\n';
      case 'strong':
      case 'b': {
        const inner = children().trim();
        return inner ? `**${inner}**` : '';
      }
      case 'em':
      case 'i': {
        const inner = children().trim();
        return inner ? `*${inner}*` : '';
      }
      case 's':
      case 'del': {
        const inner = children().trim();
        return inner ? `~~${inner}~~` : '';
      }
      case 'code': {
        if (el.closest('pre')) return children();
        const inner = children().trim();
        return inner ? `\`${inner}\`` : '';
      }
      case 'pre':
        return `\n\n\`\`\`\n${(el.textContent ?? '').replace(/\n+$/, '')}\n\`\`\`\n\n`;
      case 'a': {
        const href = el.getAttribute('href') ?? '';
        const label = children().trim();
        if (!href || !/^(https?:|mailto:|\/)/i.test(href)) return label;
        return label && label !== href ? `[${label}](${href})` : href;
      }
      case 'h1':
      case 'h2':
      case 'h3':
      case 'h4':
      case 'h5':
      case 'h6':
        return `\n\n${'#'.repeat(Number(tag[1]))} ${children().trim()}\n\n`;
      case 'blockquote':
        return `\n\n${children().trim().split('\n').map((line) => `> ${line}`).join('\n')}\n\n`;
      case 'li': {
        const ordered = el.parentElement?.tagName.toLowerCase() === 'ol';
        const index = Array.from(el.parentElement?.children ?? []).indexOf(el) + 1;
        const marker = ordered ? `${index}. ` : '- ';
        return `${marker}${children().trim().replace(/\n+/g, ' ')}\n`;
      }
      case 'ul':
      case 'ol':
        return `\n\n${children().trim()}\n\n`;
      case 'p':
      case 'div':
      case 'section':
      case 'article':
      case 'tr':
        return `\n\n${children().trim()}\n\n`;
      default:
        return children();
    }
  };

  return walk(doc.body)
    .replace(NBSP, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function autoGrow(input: HTMLTextAreaElement) {
  input.style.height = 'auto';
  input.style.height = `${Math.min(input.scrollHeight + 2, 520)}px`;
}

function refreshPreview(form: HTMLFormElement) {
  const target = form.querySelector<HTMLElement>('[data-md-preview-target]');
  const input = form.querySelector<HTMLTextAreaElement>('textarea[name="body"]');
  if (!target || target.hidden || !input) return;
  target.innerHTML = renderMarkdown(input.value);
}

document.addEventListener('click', (event) => {
  const target = event.target as HTMLElement | null;
  const button = target?.closest<HTMLButtonElement>('[data-md], [data-md-preview]');
  if (!button) return;

  const form = button.closest('form');
  const input = textareaOf(button);
  if (!form || !input) return;
  event.preventDefault();

  if (button.hasAttribute('data-md-preview')) {
    const preview = form.querySelector<HTMLElement>('[data-md-preview-target]');
    if (!preview) return;
    preview.hidden = !preview.hidden;
    button.setAttribute('aria-pressed', String(!preview.hidden));
    // Swap the editor out while previewing; a hidden `required` field would
    // otherwise block submitting.
    input.hidden = !preview.hidden;
    input.required = !input.hidden;
    refreshPreview(form);
    return;
  }

  const action = button.dataset.md!;
  if (WRAPS[action]) applyWrap(input, WRAPS[action]!);
  else if (PREFIXES[action]) applyPrefix(input, PREFIXES[action]!);
  else if (action === 'link') applyLink(input);
});

document.addEventListener('input', (event) => {
  const input = event.target as HTMLElement | null;
  if (!(input instanceof HTMLTextAreaElement) || input.name !== 'body') return;
  autoGrow(input);
  const form = input.closest('form');
  if (form) refreshPreview(form);
});

document.addEventListener('paste', (event) => {
  const input = event.target as HTMLElement | null;
  if (!(input instanceof HTMLTextAreaElement) || input.name !== 'body') return;
  const html = event.clipboardData?.getData('text/html');
  if (!html) return; // Plain text pastes already keep their line breaks.

  const markdown = htmlToMarkdown(html);
  if (!markdown) return;
  event.preventDefault();
  replaceSelection(input, markdown, markdown.length, markdown.length);
  autoGrow(input);
});

document.addEventListener('keydown', (event) => {
  const input = event.target as HTMLElement | null;
  if (!(input instanceof HTMLTextAreaElement) || input.name !== 'body') return;

  const shortcut = event.metaKey || event.ctrlKey;
  if (!shortcut) return;

  const key = event.key.toLowerCase();
  if (key === 'enter') {
    event.preventDefault();
    input.closest('form')?.requestSubmit();
    return;
  }
  const action = key === 'b' ? 'bold' : key === 'i' ? 'italic' : key === 'k' ? 'link' : null;
  if (!action) return;
  event.preventDefault();
  if (action === 'link') applyLink(input);
  else applyWrap(input, WRAPS[action]!);
});

// Deleting a comment is irreversible — always ask first.
document.addEventListener('submit', (event) => {
  const form = event.target as HTMLFormElement;
  const message = form.dataset?.confirm;
  if (!message) return;
  if (!window.confirm(message)) event.preventDefault();
});

// Reply boxes start collapsed; opening one focuses the textarea.
document.addEventListener('toggle', (event) => {
  const details = event.target as HTMLElement | null;
  if (!(details instanceof HTMLDetailsElement) || !details.classList.contains('inline-reply')) return;
  if (!details.open) return;
  const input = details.querySelector<HTMLTextAreaElement>('textarea[name="body"]');
  input?.focus();
  if (input) autoGrow(input);
}, true);

document.querySelectorAll<HTMLTextAreaElement>('textarea[name="body"]').forEach(autoGrow);
