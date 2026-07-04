import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const user = locals.user;
  if (!user) return redirect('/vhod', 303);
  if (user.role !== 'admin') return redirect('/', 303);

  const db = locals.runtime.env.DB;
  const form = await request.formData();
  const reportId = Number(form.get('report_id'));
  const action = String(form.get('action'));

  const report = await db
    .prepare(`SELECT id, post_id FROM reports WHERE id = ? AND status = 'pending'`)
    .bind(reportId)
    .first<{ id: number; post_id: number | null }>();

  if (report) {
    if (action === 'hide') {
      if (report.post_id) {
        await db.prepare('UPDATE posts SET hidden = 1 WHERE id = ?').bind(report.post_id).run();
      }
      await db.prepare(`UPDATE reports SET status = 'hidden' WHERE id = ?`).bind(report.id).run();
    } else {
      await db.prepare(`UPDATE reports SET status = 'approved' WHERE id = ?`).bind(report.id).run();
    }
  }
  return redirect('/admin', 303);
};
