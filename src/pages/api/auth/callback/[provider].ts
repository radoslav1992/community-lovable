import type { APIRoute } from 'astro';
import { getProviderConfig, callbackUrl, fetchProfile, upsertOAuthUser, type OAuthProvider } from '../../../../lib/oauth';
import { createSession, setSessionCookie } from '../../../../lib/auth';

export const GET: APIRoute = async ({ params, locals, cookies, redirect, url }) => {
  const provider = params.provider as OAuthProvider;
  if (provider !== 'google' && provider !== 'github') return redirect('/vhod', 303);

  const cfg = getProviderConfig(locals.runtime.env, provider);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const stateCookie = cookies.get('oauth_state')?.value;
  cookies.delete('oauth_state', { path: '/' });

  if (!cfg || !code || !state || stateCookie !== `${provider}:${state}`) {
    return redirect('/vhod?greshka=oauth', 303);
  }

  try {
    const profile = await fetchProfile(provider, cfg, code, callbackUrl(url.origin, provider));
    const db = locals.runtime.env.DB;
    const userId = await upsertOAuthUser(db, provider, profile);
    if (userId === null) return redirect('/vhod?greshka=blokiran', 303);

    const { token, expires } = await createSession(db, userId);
    setSessionCookie(cookies, token, expires);
    return redirect('/', 303);
  } catch {
    return redirect('/vhod?greshka=oauth', 303);
  }
};
