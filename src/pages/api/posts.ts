import type { APIRoute } from 'astro';
import { slugify, uniqueSlug } from '../../lib/slug';
import { TAGS } from '../../lib/format';

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const user = locals.user;
  if (!user) return redirect('/vhod', 303);
  if (user.blocked) return redirect('/?greshka=blokiran', 303);

  const db = locals.runtime.env.DB;
  const form = await request.formData();
  const title = String(form.get('title') ?? '').trim().slice(0, 200);
  const body = String(form.get('body') ?? '').trim().slice(0, 10_000);
  const tagRaw = String(form.get('tag') ?? 'Дискусия');
  const tag = TAGS.includes(tagRaw) ? tagRaw : 'Дискусия';

  if (!title) return redirect('/?post=new&greshka=zaglavie#composer', 303);

  const slug = await uniqueSlug(db, 'posts', slugify(title));
  const excerpt = (body || title).slice(0, 180);
  await db
    .prepare('INSERT INTO posts (user_id, tag, title, slug, excerpt, body) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(user.id, tag, title, slug, excerpt, body || title)
    .run();

  return redirect(`/t/${slug}`, 303);
};
