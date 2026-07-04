import type { APIRoute } from 'astro';
import { deleteSession, clearSessionCookie, SESSION_COOKIE } from '../../../lib/auth';

export const POST: APIRoute = async ({ locals, cookies, redirect }) => {
  const token = cookies.get(SESSION_COOKIE)?.value;
  if (token) await deleteSession(locals.runtime.env.DB, token);
  clearSessionCookie(cookies);
  return redirect('/', 303);
};
