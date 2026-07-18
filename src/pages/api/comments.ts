import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const user = locals.user;
  if (!user) return redirect('/vhod', 303);

  const db = locals.runtime.env.DB;
  const form = await request.formData();
  const postId = Number(form.get('post_id'));
  const slug = String(form.get('slug') ?? '');
  const body = String(form.get('body') ?? '').trim().slice(0, 2000);
  const rawParentId = Number(form.get('parent_id'));
  const parentId = Number.isInteger(rawParentId) && rawParentId > 0 ? rawParentId : null;

  const post = await db
    .prepare('SELECT slug FROM posts WHERE id = ? AND hidden = 0')
    .bind(postId)
    .first<{ slug: string }>();
  if (!post) return redirect('/', 303);

  const backUrl = `/t/${post.slug ?? slug}`;
  if (user.blocked) return redirect(`${backUrl}?greshka=blokiran#komentari`, 303);
  if (!body) return redirect(`${backUrl}#komentari`, 303);

  let replyAnchor = 'komentari';
  if (parentId) {
    const parent = await db
      .prepare('SELECT id FROM comments WHERE id = ? AND post_id = ?')
      .bind(parentId, postId)
      .first<{ id: number }>();

    if (!parent) return redirect(`${backUrl}#komentari`, 303);
    replyAnchor = `comment-${parent.id}`;
  }

  await db
    .prepare('INSERT INTO comments (post_id, user_id, parent_id, body) VALUES (?, ?, ?, ?)')
    .bind(postId, user.id, parentId, body)
    .run();

  return redirect(`${backUrl}#${replyAnchor}`, 303);
};
