import type { APIRoute } from 'astro';

/** Премахване на проект — от автора му или от модератор/админ. */
export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const user = locals.user;
  if (!user) return redirect('/vhod', 303);

  const db = locals.runtime.env.DB;
  const form = await request.formData();
  const projectId = Number(form.get('project_id'));

  const project = await db
    .prepare('SELECT id, user_id FROM projects WHERE id = ?')
    .bind(projectId)
    .first<{ id: number; user_id: number | null }>();
  if (!project) return redirect('/proekti', 303);

  const isStaff = user.role === 'admin' || user.role === 'moderator';
  if (project.user_id !== user.id && !isStaff) return redirect('/proekti?greshka=prava', 303);

  await db.prepare('DELETE FROM projects WHERE id = ?').bind(projectId).run();
  return redirect('/proekti?iztrit=1', 303);
};
