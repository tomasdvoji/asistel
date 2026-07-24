import { defineConfig } from 'astro/config';

const isNetlify = process.env.NETLIFY === 'true';

export default defineConfig({
  site: isNetlify ? process.env.URL : 'https://tomasdvoji.github.io',
  base: isNetlify ? '/' : '/asistel',
});
