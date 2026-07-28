import type { APIRoute } from 'astro';
import { commentFeatures } from '../../lib/schema';

/** Control characters that would never be typed on purpose. */
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g;

/** Comments are Markdown, so they need more room than a one-liner. */
const MAX_LENGTH = 5000;

/** Keeps the author's line breaks; trims trailing whitespace and blank runs. */
function normalizeBody(raw: string): string {
  return raw
    .replace(/\r\n?/g, '\n')
    .replace(CONTROL_CHARS, '')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, MAX_LENGTH);
}

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const user = locals.user;
  if (!user) return redirect('/vhod', 303);

  const db = locals.runtime.env.DB;
  const form = await request.formData();
  const postId = Number(form.get('post_id'));
  const slug = String(form.get('slug') ?? '');
  const body = normalizeBody(String(form.get('body') ?? ''));
  const rawParentId = Number(form.get('parent_id'));
  const requestedParentId = Number.isInteger(rawParentId) && rawParentId > 0 ? rawParentId : null;

  const post = await db
    .prepare('SELECT slug FROM posts WHERE id = ? AND hidden = 0')
    .bind(postId)
    .first<{ slug: string }>();
  if (!post) return redirect('/', 303);

  const backUrl = `/t/${post.slug ?? slug}`;
  if (user.blocked) return redirect(`${backUrl}?greshka=blokiran#komentari`, 303);
  if (!body) return redirect(`${backUrl}#komentari`, 303);

  const features = await commentFeatures(db);
  const parentId = features.replies ? requestedParentId : null;

  let replyAnchor = 'komentari';
  if (parentId) {
    const parent = await db
      .prepare('SELECT id FROM comments WHERE id = ? AND post_id = ?')
      .bind(parentId, postId)
      .first<{ id: number }>();

    if (!parent) return redirect(`${backUrl}#komentari`, 303);
    replyAnchor = `comment-${parent.id}`;
  }

  if (features.replies) {
    await db
      .prepare('INSERT INTO comments (post_id, user_id, parent_id, body) VALUES (?, ?, ?, ?)')
      .bind(postId, user.id, parentId, body)
      .run();
  } else {
    await db
      .prepare('INSERT INTO comments (post_id, user_id, body) VALUES (?, ?, ?)')
      .bind(postId, user.id, body)
      .run();
  }

  return redirect(`${backUrl}#${replyAnchor}`, 303);
};
