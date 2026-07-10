// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  site: 'https://communitylovable.bg',
  output: 'server',
  adapter: cloudflare({
    platformProxy: { enabled: true },
    imageService: 'compile',
    workerEntryPoint: { path: 'src/worker.ts' },
  }),
  server: { port: 4321 },
});
