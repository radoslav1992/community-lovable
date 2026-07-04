/// <reference types="astro/client" />
/// <reference types="@cloudflare/workers-types" />

type Env = {
  DB: D1Database;
  ASSETS: Fetcher;
};

type Runtime = import('@astrojs/cloudflare').Runtime<Env>;

declare namespace App {
  interface Locals extends Runtime {
    user: import('./lib/auth').SessionUser | null;
  }
}
