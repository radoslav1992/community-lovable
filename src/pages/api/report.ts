import type { APIRoute } from 'astro';

const REASONS = ['Спам / реклама', 'Неуважително отношение', 'Подвеждащо съдържание', 'Друго'];

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const user = locals.user;
  if (!user) return redirect('/vhod', 303);

  const db = locals.runtime.env.DB;
  const form = await request.formData();
  const postId = Number(form.get('post_id'));
  const reasonRaw = String(form.get('reason') ?? '');
  const reason = REASONS.includes(reasonRaw) ? reasonRaw : 'Друго';

  const post = await db
    .prepare('SELECT slug, title FROM posts WHERE id = ? AND hidden = 0')
    .bind(postId)
    .first<{ slug: string; title: string }>();
  if (!post) return redirect('/', 303);

  const already = await db
    .prepare(`SELECT 1 FROM reports WHERE post_id = ? AND reporter_id = ? AND status = 'pending'`)
    .bind(postId, user.id)
    .first();
  if (!already) {
    await db
      .prepare('INSERT INTO reports (post_id, title, reason, reporter_id, reporter_name) VALUES (?, ?, ?, ?, ?)')
      .bind(postId, post.title, reason, user.id, user.name)
      .run();
  }
  return redirect(`/t/${post.slug}?dokladvano=1`, 303);
};
