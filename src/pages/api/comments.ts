import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const user = locals.user;
  if (!user) return redirect('/vhod', 303);

  const db = locals.runtime.env.DB;
  const form = await request.formData();
  const postId = Number(form.get('post_id'));
  const slug = String(form.get('slug') ?? '');
  const body = String(form.get('body') ?? '').trim().slice(0, 2000);

  const post = await db
    .prepare('SELECT slug FROM posts WHERE id = ? AND hidden = 0')
    .bind(postId)
    .first<{ slug: string }>();
  if (!post) return redirect('/', 303);

  const backUrl = `/t/${post.slug ?? slug}`;
  if (user.blocked) return redirect(`${backUrl}?greshka=blokiran#komentari`, 303);
  if (!body) return redirect(`${backUrl}#komentari`, 303);

  await db
    .prepare('INSERT INTO comments (post_id, user_id, body) VALUES (?, ?, ?)')
    .bind(postId, user.id, body)
    .run();

  return redirect(`${backUrl}#komentari`, 303);
};
