import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import node from '@astrojs/node';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: node({
    mode: 'standalone',
  }),
  prefetch: true,
  integrations: [tailwind()],
  server: {
    port: 4321,
    host: '0.0.0.0',
  },
});
