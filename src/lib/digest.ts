import { bgDate, eventDayMonth } from './format';

const SITE = 'https://communitylovable.bg';
const DEFAULT_FROM = 'Lovable Общност <byuletin@communitylovable.bg>';

interface DigestPost {
  title: string;
  slug: string;
  excerpt: string;
  tag: string;
  author_name: string;
  votes: number;
  comment_count: number;
}

interface DigestEvent {
  title: string;
  starts_at: string;
  place: string;
  is_live: number;
}

interface DigestNews {
  title: string;
  slug: string;
  excerpt: string;
}

export interface DigestContent {
  posts: DigestPost[];
  events: DigestEvent[];
  news: DigestNews[];
}

interface Recipient {
  id: number;
  email: string;
  name: string;
  digest_token: string;
}

export async function buildDigest(db: D1Database): Promise<DigestContent | null> {
  const [postsRes, eventsRes, newsRes] = await db.batch([
    db.prepare(
      `SELECT p.title, p.slug, p.excerpt, p.tag, u.name AS author_name,
        p.base_votes + (SELECT COUNT(*) FROM votes v WHERE v.post_id = p.id) AS votes,
        (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comment_count
      FROM posts p JOIN users u ON u.id = p.user_id
      WHERE p.hidden = 0 AND p.created_at > datetime('now', '-7 days')
      ORDER BY votes DESC, comment_count DESC
      LIMIT 5`
    ),
    db.prepare(
      `SELECT title, starts_at, place, is_live FROM events
       WHERE starts_at > datetime('now') ORDER BY starts_at LIMIT 3`
    ),
    db.prepare(
      `SELECT title, slug, excerpt FROM news
       WHERE published_at > datetime('now', '-7 days') ORDER BY published_at DESC LIMIT 3`
    ),
  ]);

  const content: DigestContent = {
    posts: postsRes.results as unknown as DigestPost[],
    events: eventsRes.results as unknown as DigestEvent[],
    news: newsRes.results as unknown as DigestNews[],
  };
  // Nothing new and nothing upcoming — skip this week's issue instead of sending an empty email.
  if (content.posts.length === 0 && content.events.length === 0 && content.news.length === 0) return null;
  return content;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function renderDigestHtml(content: DigestContent, recipient: Recipient): string {
  const unsubUrl = `${SITE}/otpisvane?u=${recipient.id}&t=${recipient.digest_token}`;
  const section = (label: string) =>
    `<p style="margin:28px 0 10px;font-size:12px;font-weight:800;letter-spacing:0.08em;color:#9B968A">${label}</p>`;

  const posts = content.posts
    .map(
      (p) => `<div style="margin:0 0 16px">
<a href="${SITE}/t/${p.slug}" style="font-size:17px;font-weight:800;color:#1B1B1B;text-decoration:none">${esc(p.title)}</a>
<p style="margin:4px 0 0;font-size:14px;line-height:1.5;color:#6E695E">${esc(p.excerpt)}</p>
<p style="margin:4px 0 0;font-size:13px;color:#9B968A">${esc(p.author_name)} · ▲ ${p.votes} · 💬 ${p.comment_count}</p>
</div>`
    )
    .join('');

  const events = content.events
    .map((ev) => {
      const d = eventDayMonth(ev.starts_at);
      return `<div style="margin:0 0 14px">
<span style="font-weight:800;color:#FF0178">${d.day.replace(/^0/, '')} ${d.month}</span>
<span style="font-size:15px;font-weight:800;color:#1B1B1B"> · ${esc(ev.title)}</span>
<p style="margin:2px 0 0;font-size:13px;color:#6E695E">${esc(ev.place)}</p>
</div>`;
    })
    .join('');

  const news = content.news
    .map(
      (n) => `<div style="margin:0 0 14px">
<a href="${SITE}/novini/${n.slug}" style="font-size:15px;font-weight:800;color:#1B1B1B;text-decoration:none">${esc(n.title)}</a>
<p style="margin:2px 0 0;font-size:13px;line-height:1.5;color:#6E695E">${esc(n.excerpt)}</p>
</div>`
    )
    .join('');

  return `<!doctype html>
<html lang="bg">
<body style="margin:0;padding:0;background:#F7F4ED;font-family:system-ui,-apple-system,'Segoe UI',sans-serif">
<div style="max-width:560px;margin:0 auto;padding:32px 20px">
  <div style="margin-bottom:24px">
    <span style="font-size:18px;font-weight:800;color:#1B1B1B">Lovable Общност</span>
    <span style="font-size:11px;font-weight:700;color:#FF0178;letter-spacing:0.08em"> · СЕДМИЧЕН БЮЛЕТИН</span>
  </div>
  <div style="background:#ffffff;border:1px solid #E7E3D6;border-radius:16px;padding:26px">
    <p style="margin:0;font-size:15px;line-height:1.55;color:#3A362E">Здравей, ${esc(recipient.name.split(' ')[0] ?? '')}! Ето най-интересното от общността тази седмица.</p>
    ${content.posts.length ? section('НАЙ-ОБСЪЖДАНОТО') + posts : ''}
    ${content.events.length ? section('ПРЕДСТОЯЩИ СЪБИТИЯ') + events : ''}
    ${content.news.length ? section('НОВИНИ') + news : ''}
    <a href="${SITE}/" style="display:inline-block;margin-top:20px;padding:10px 22px;border-radius:99px;background:#1B1B1B;color:#F7F4ED;font-weight:700;font-size:14px;text-decoration:none">Към общността →</a>
  </div>
  <p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#9B968A;text-align:center">
    Получаваш този имейл, защото си включил седмичния бюлетин на communitylovable.bg.<br/>
    <a href="${unsubUrl}" style="color:#9B968A">Отпиши се с един клик</a>
  </p>
</div>
</body>
</html>`;
}

export function renderDigestText(content: DigestContent, recipient: Recipient): string {
  const lines: string[] = ['LOVABLE ОБЩНОСТ — СЕДМИЧЕН БЮЛЕТИН', ''];
  if (content.posts.length) {
    lines.push('НАЙ-ОБСЪЖДАНОТО:');
    for (const p of content.posts) lines.push(`- ${p.title} (${SITE}/t/${p.slug})`);
    lines.push('');
  }
  if (content.events.length) {
    lines.push('ПРЕДСТОЯЩИ СЪБИТИЯ:');
    for (const ev of content.events) lines.push(`- ${bgDate(ev.starts_at)} · ${ev.title} · ${ev.place}`);
    lines.push('');
  }
  if (content.news.length) {
    lines.push('НОВИНИ:');
    for (const n of content.news) lines.push(`- ${n.title} (${SITE}/novini/${n.slug})`);
    lines.push('');
  }
  lines.push(`Отпиши се: ${SITE}/otpisvane?u=${recipient.id}&t=${recipient.digest_token}`);
  return lines.join('\n');
}

async function getRecipients(db: D1Database, onlyUserId?: number): Promise<Recipient[]> {
  // Blocked users and deleted accounts (no password, no OAuth) never receive mail.
  const sql = `SELECT id, email, name, digest_token FROM users
    WHERE notif_digest = 1 AND blocked = 0
      AND (password_hash IS NOT NULL OR oauth_provider IS NOT NULL)
      ${onlyUserId ? 'AND id = ?' : ''}`;
  const stmt = onlyUserId ? db.prepare(sql).bind(onlyUserId) : db.prepare(sql);
  const rows = (await stmt.all<Recipient>()).results;

  // Backfill tokens for accounts created before the digest_token migration.
  for (const r of rows) {
    if (!r.digest_token) {
      const token = [...crypto.getRandomValues(new Uint8Array(16))]
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      await db.prepare('UPDATE users SET digest_token = ? WHERE id = ?').bind(token, r.id).run();
      r.digest_token = token;
    }
  }
  return rows;
}

export interface DigestRunResult {
  skipped: boolean;
  sent: number;
  failed: number;
}

/** Sends the weekly digest. With `onlyUserId`, sends a single test issue to that user. */
export async function sendWeeklyDigest(env: Env, onlyUserId?: number): Promise<DigestRunResult> {
  const content = await buildDigest(env.DB);
  if (!content) return { skipped: true, sent: 0, failed: 0 };

  const recipients = await getRecipients(env.DB, onlyUserId);
  const from = env.DIGEST_FROM || DEFAULT_FROM;
  let sent = 0;
  let failed = 0;

  for (const r of recipients) {
    try {
      await env.EMAIL.send({
        from,
        to: { email: r.email, name: r.name },
        subject: 'Седмичен бюлетин — Lovable Общност',
        html: renderDigestHtml(content, r),
        text: renderDigestText(content, r),
        headers: {
          'List-Unsubscribe': `<${SITE}/otpisvane?u=${r.id}&t=${r.digest_token}>`,
        },
      });
      sent++;
    } catch (err) {
      failed++;
      console.error(`digest: failed to send to user ${r.id}:`, err);
    }
  }
  console.log(`digest: sent=${sent} failed=${failed} recipients=${recipients.length}`);
  return { skipped: false, sent, failed };
}
