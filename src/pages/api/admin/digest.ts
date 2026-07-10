import type { APIRoute } from 'astro';
import { sendWeeklyDigest } from '../../../lib/digest';

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const user = locals.user;
  if (!user) return redirect('/vhod', 303);
  if (user.role !== 'admin') return redirect('/', 303);

  const form = await request.formData();
  const action = String(form.get('action'));

  const result =
    action === 'send'
      ? await sendWeeklyDigest(locals.runtime.env)
      : await sendWeeklyDigest(locals.runtime.env, user.id);

  const status = result.skipped ? 'prazen' : `ok-${result.sent}-${result.failed}`;
  return redirect(`/admin?byuletin=${status}#byuletin`, 303);
};
