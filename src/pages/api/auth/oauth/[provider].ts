import type { APIRoute } from 'astro';
import { getProviderConfig, callbackUrl, type OAuthProvider } from '../../../../lib/oauth';

export const GET: APIRoute = async ({ params, locals, cookies, redirect, url }) => {
  const provider = params.provider as OAuthProvider;
  if (provider !== 'google' && provider !== 'github') return redirect('/vhod', 303);

  const cfg = getProviderConfig(locals.runtime.env, provider);
  if (!cfg) return redirect('/vhod?greshka=oauth', 303);

  const state = [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('');
  cookies.set('oauth_state', `${provider}:${state}`, {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 600,
  });

  const authorize = new URL(cfg.authorizeUrl);
  authorize.searchParams.set('client_id', cfg.clientId);
  authorize.searchParams.set('redirect_uri', callbackUrl(url.origin, provider));
  authorize.searchParams.set('response_type', 'code');
  authorize.searchParams.set('scope', cfg.scope);
  authorize.searchParams.set('state', state);
  return redirect(authorize.href, 302);
};
