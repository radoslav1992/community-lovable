// Custom Worker entry point: keeps Astro's fetch handler and adds the
// scheduled (cron) handler that sends the weekly email digest.
import { createExports as createAstroExports } from '@astrojs/cloudflare/entrypoints/server.js';
import type { SSRManifest } from 'astro';
import { sendWeeklyDigest } from './lib/digest';

export function createExports(manifest: SSRManifest) {
  const astro = createAstroExports(manifest);
  return {
    default: {
      ...astro.default,
      scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
        ctx.waitUntil(sendWeeklyDigest(env));
      },
    },
  };
}
