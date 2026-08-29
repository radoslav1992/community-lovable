import type { APIRoute } from 'astro';

/** Харесване на проект — toggle. Връща JSON при заявка с Accept: application/json. */
export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const user = locals.user;
  const wantsJson = request.headers.get('accept')?.includes('application/json');
  if (!user) {
    return wantsJson
      ? new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } })
      : redirect('/vhod', 303);
  }

  const db = locals.runtime.env.DB;
  const form = await request.formData();
  const projectId = Number(form.get('project_id'));
  const backRaw = String(form.get('back') ?? '/proekti');
  const back = backRaw.startsWith('/') && !backRaw.startsWith('//') ? backRaw : '/proekti';

  const project = await db.prepare('SELECT id FROM projects WHERE id = ? AND hidden = 0').bind(projectId).first();
  if (!project) return wantsJson ? new Response(null, { status: 404 }) : redirect(back, 303);

  const existing = await db
    .prepare('SELECT 1 FROM project_votes WHERE user_id = ? AND project_id = ?')
    .bind(user.id, projectId)
    .first();

  if (existing) {
    await db.prepare('DELETE FROM project_votes WHERE user_id = ? AND project_id = ?').bind(user.id, projectId).run();
  } else {
    await db.prepare('INSERT INTO project_votes (user_id, project_id) VALUES (?, ?)').bind(user.id, projectId).run();
  }

  if (wantsJson) {
    const row = await db
      .prepare(
        `SELECT base_votes + (SELECT COUNT(*) FROM project_votes pv WHERE pv.project_id = projects.id) AS votes
         FROM projects WHERE id = ?`
      )
      .bind(projectId)
      .first<{ votes: number }>();
    return new Response(JSON.stringify({ votes: row?.votes ?? 0, voted: !existing }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return redirect(back, 303);
};
