import { defineMiddleware } from 'astro:middleware';
import { getSessionUser, SESSION_COOKIE } from './lib/auth';

export const onRequest = defineMiddleware(async (context, next) => {
  context.locals.user = null;
  const token = context.cookies.get(SESSION_COOKIE)?.value;
  if (token) {
    try {
      const db = context.locals.runtime.env.DB;
      context.locals.user = await getSessionUser(db, token);
    } catch {
      // No DB binding (e.g. prerendered asset request) — treat as guest.
    }
  }
  return next();
});
