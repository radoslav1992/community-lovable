import type { APIRoute } from 'astro';
import { fetchProfileHtml, parseProfileBadges } from '../../../lib/lovable';

const FETCH_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
  Accept: '*/*',
};

/**
 * Scans the profile page's script bundles for API route candidates — the
 * browser-side fetch targets that deliver the activity stats. Fetches up to
 * `maxChunks` referenced chunk files and greps them for /api|trpc paths and
 * activity-related keywords.
 */
async function discoverApiCandidates(html: string, origin: string, maxChunks: number) {
  const chunkUrls = [
    ...new Set(
      [...html.matchAll(/\/_next\/static\/chunks\/[^"'\\ )]+\.js[^"'\\ )]*/g)].map((m) =>
        m[0]!.startsWith('http') ? m[0]! : origin + m[0]!
      )
    ),
  ].slice(0, maxChunks);

  const apiPaths = new Set<string>();
  const keywordHits: Record<string, string[]> = {};
  const scanned: string[] = [];

  for (const cu of chunkUrls) {
    try {
      const res = await fetch(cu, { signal: AbortSignal.timeout(8_000), headers: FETCH_HEADERS });
      if (!res.ok) continue;
      const js = (await res.text()).slice(0, 2_000_000);
      scanned.push(cu.slice(cu.lastIndexOf('/') + 1));
      for (const m of js.matchAll(/["'`](\/(?:api|trpc)\/[^"'`\s\\]{2,140})["'`]/g)) apiPaths.add(m[1]!);
      for (const m of js.matchAll(/["'`](https:\/\/[a-z0-9.-]*lovable[a-z0-9.-]*\/[^"'`\s\\]{2,140})["'`]/gi))
        apiPaths.add(m[1]!);
      for (const kw of ['totalEdits', 'total_edits', 'daysActive', 'days_active', 'editCount', 'activity']) {
        for (const m of js.matchAll(new RegExp(kw, 'g'))) {
          (keywordHits[kw] ??= []).push(js.slice(Math.max(0, m.index! - 120), m.index! + 160));
          if (keywordHits[kw]!.length >= 3) break;
        }
      }
    } catch {
      // unreachable chunk — skip
    }
  }

  return { chunksScanned: scanned.length, chunkNames: scanned, apiPaths: [...apiPaths].sort(), keywordHits };
}

/**
 * Admin-only diagnostic: shows what the Worker actually receives when
 * fetching a Lovable profile, so parser gaps can be identified from
 * production without guessing. GET /api/lovable/debug?u=<profile-url>
 * (defaults to the admin's own linked profile). Add &mode=discover to scan
 * the page's script bundles for the API routes serving the activity stats.
 */
export const GET: APIRoute = async ({ url, locals }) => {
  const user = locals.user;
  if (!user || user.role !== 'admin') return new Response(null, { status: 404 });

  const target = url.searchParams.get('u') || user.lovable_profile_url;
  if (!target || !/^https:\/\/lovable\.dev\//.test(target)) {
    return Response.json({ error: 'no profile url' }, { status: 400 });
  }

  if (url.searchParams.get('mode') === 'discover') {
    const html = await fetchProfileHtml(target);
    if (html === null) return Response.json({ target, fetched: false });
    const discovery = await discoverApiCandidates(html, 'https://lovable.dev', 25);
    return Response.json({ target, fetched: true, ...discovery });
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
