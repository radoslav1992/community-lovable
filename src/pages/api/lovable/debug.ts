import type { APIRoute } from 'astro';
import { fetchProfileHtml, fetchProfileRsc, parseProfileBadges } from '../../../lib/lovable';

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
async function discoverApiCandidates(html: string, origin: string, maxChunks: number, skip = 0) {
  const all = [
    ...new Set(
      [...html.matchAll(/\/_next\/static\/chunks\/[^"'\\ )]+\.js[^"'\\ )]*/g)].map((m) =>
        m[0]!.startsWith('http') ? m[0]! : origin + m[0]!
      )
    ),
  ];
  // Page-specific chunks (the ones that fetch the activity data) are
  // referenced late in the document — scan from the end; `skip` shifts the
  // window further back for a second pass.
  const end = Math.max(0, all.length - skip);
  const chunkUrls = all.slice(Math.max(0, end - maxChunks), end);

  const apiPaths = new Set<string>();
  const externalUrls = new Set<string>();
  const statChunks: { chunk: string; excerpts: string[]; urls: string[] }[] = [];
  const scanned: string[] = [];

  for (const cu of chunkUrls) {
    try {
      const res = await fetch(cu, { signal: AbortSignal.timeout(8_000), headers: FETCH_HEADERS });
      if (!res.ok) continue;
      const js = (await res.text()).slice(0, 2_000_000);
      scanned.push(cu.slice(cu.lastIndexOf('/') + 1));
      for (const m of js.matchAll(/["'`](\/(?:api|trpc)\/[^"'`\s\\]{2,140})["'`]/g)) apiPaths.add(m[1]!);
      for (const m of js.matchAll(/["'`](https:\/\/[a-z0-9.-]+\/[^"'`\s\\]{2,140})["'`]/gi)) {
        if (/api|graphql|trpc|supabase|firestore|functions|edge|rpc/i.test(m[1]!)) externalUrls.add(m[1]!);
      }
      // A chunk mentioning the stat labels is (or feeds) the activity panel —
      // report its fetch targets and the code around the labels.
      const statRe = /total\s?_?edits|Total Edits|days\s?_?active|Days Active|editCount|currentStreak/gi;
      if (statRe.test(js)) {
        statRe.lastIndex = 0;
        const excerpts: string[] = [];
        for (const m of js.matchAll(statRe)) {
          excerpts.push(js.slice(Math.max(0, m.index! - 200), m.index! + 260));
          if (excerpts.length >= 4) break;
        }
        const urls = [
          ...new Set(
            [...js.matchAll(/["'`]((?:https:\/\/[a-z0-9.-]+)?\/?[^"'`\s\\]{0,20}(?:api|trpc|graphql|rpc)[^"'`\s\\]{0,140})["'`]/gi)].map(
              (m) => m[1]!
            )
          ),
        ].slice(0, 20);
        statChunks.push({ chunk: cu.slice(cu.lastIndexOf('/') + 1), excerpts, urls });
      }
    } catch {
      // unreachable chunk — skip
    }
  }

  return {
    totalChunks: all.length,
    chunksScanned: scanned.length,
    window: { skip, maxChunks },
    apiPaths: [...apiPaths].sort(),
    externalUrls: [...externalUrls].sort().slice(0, 40),
    statChunks,
  };
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
  if (!target || !/^https:\/\/([a-z0-9-]+\.)?lovable\.dev\//.test(target)) {
    return Response.json({ error: 'no profile url' }, { status: 400 });
  }

  // The profile page hydrates from api.lovable.dev (PublicProfileBody.json
  // schema); the activity panel data is fetched client-side. Probe the
  // plausible endpoint shapes and report what each returns.
  if (url.searchParams.get('mode') === 'api') {
    const username = target.match(/\/@([^/]+)/)?.[1] ?? user.lovable_username ?? '';
    // Optional account id (from the flight payload's initialProfileData.id)
    // for id-keyed routes.
    const id = url.searchParams.get('id');
    const candidates = [
      `https://api.lovable.dev/v1/profiles/${username}`,
      `https://api.lovable.dev/v1/users/${username}`,
      `https://api.lovable.dev/v1/profiles/${username}/activity`,
      `https://api.lovable.dev/v1/users/${username}/activity`,
      `https://api.lovable.dev/v2/profiles/${username}`,
      `https://api.lovable.dev/public/profiles/${username}`,
      `https://api.lovable.dev/public-profiles/${username}`,
      `https://api.lovable.dev/user-profiles/${username}`,
      `https://api.lovable.dev/profiles/by-username/${username}`,
      ...(id
        ? [
            `https://api.lovable.dev/users/${id}`,
            `https://api.lovable.dev/profiles/${id}`,
            `https://api.lovable.dev/v1/users/${id}`,
            `https://api.lovable.dev/users/${id}/activity`,
            `https://api.lovable.dev/v1/users/${id}/activity`,
            `https://api.lovable.dev/v1/users/${id}/edits`,
          ]
        : []),
    ];
    const results = [];
    for (const cu of candidates) {
      try {
        const res = await fetch(cu, {
          signal: AbortSignal.timeout(6_000),
          headers: { ...FETCH_HEADERS, Accept: 'application/json, */*' },
        });
        const body = (await res.text()).slice(0, 400);
        results.push({ url: cu, status: res.status, type: res.headers.get('content-type'), snippet: body });
      } catch (e) {
        results.push({ url: cu, error: String(e).slice(0, 120) });
      }
    }
    return Response.json({ username, results });
  }

  if (url.searchParams.get('mode') === 'discover') {
    const html = await fetchProfileHtml(target);
    if (html === null) return Response.json({ target, fetched: false });
    const skip = parseInt(url.searchParams.get('skip') ?? '0', 10) || 0;
    const discovery = await discoverApiCandidates(html, 'https://lovable.dev', 45, skip);
    return Response.json({ target, fetched: true, ...discovery });
  }

  if (url.searchParams.get('mode') === 'rsc') {
    const rsc = await fetchProfileRsc(target);
    if (rsc === null) return Response.json({ target, fetched: false, note: 'rsc fetch failed' });
    const markers: Record<string, number> = {};
    for (const m of ['Total Edits', 'totalEdits', 'edits', 'Days Active', 'daysActive', 'followers'])
      markers[m] = rsc.split(m).length - 1;
    const excerpts: Record<string, string> = {};
    for (const m of ['Total Edits', 'totalEdits', 'Days Active']) {
      const i = rsc.indexOf(m);
      if (i >= 0) excerpts[m] = rsc.slice(Math.max(0, i - 300), i + 400);
    }
    return Response.json({
      target,
      fetched: true,
      length: rsc.length,
      markers,
      parsed: parseProfileBadges(rsc),
      head: rsc.slice(0, 400),
      excerpts,
    });
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
