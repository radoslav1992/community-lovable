import type { APIRoute } from 'astro';
import { fetchProfileHtml, parseProfileBadges } from '../../../lib/lovable';

/**
 * Admin-only diagnostic: shows what the Worker actually receives when
 * fetching a Lovable profile, so parser gaps can be identified from
 * production without guessing. GET /api/lovable/debug?u=<profile-url>
 * (defaults to the admin's own linked profile).
 */
export const GET: APIRoute = async ({ url, locals }) => {
  const user = locals.user;
  if (!user || user.role !== 'admin') return new Response(null, { status: 404 });

  const target = url.searchParams.get('u') || user.lovable_profile_url;
  if (!target || !/^https:\/\/lovable\.dev\//.test(target)) {
    return Response.json({ error: 'no profile url' }, { status: 400 });
  }

  const html = await fetchProfileHtml(target);
  if (html === null) {
    return Response.json({ target, fetched: false, note: 'fetch failed (blocked, timeout, or non-200)' });
  }

  const markers = ['Total Edits', 'edits', 'Days Active', 'Current Streak', 'Daily Average', 'followers', '__next_f', 'self.__next'];
  const found: Record<string, number> = {};
  for (const m of markers) found[m] = html.split(m).length - 1;

  // Excerpts around the most informative markers (raw, so escaping is visible).
  const excerpts: Record<string, string> = {};
  for (const m of ['Total Edits', 'edits', 'Days Active']) {
    const i = html.indexOf(m);
    if (i >= 0) excerpts[m] = html.slice(Math.max(0, i - 300), i + 400);
  }

  return Response.json({
    target,
    fetched: true,
    length: html.length,
    markers: found,
    parsed: parseProfileBadges(html),
    head: html.slice(0, 500),
    tail: html.slice(-500),
    excerpts,
  });
};
