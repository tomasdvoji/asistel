import { defineConfig } from 'astro/config';

// GitHub Pages běží pod /asistel, všude jinde (Netlify, Cloudflare, lokál) je web v kořeni.
const isGithubPages = process.env.GITHUB_ACTIONS === 'true';

export default defineConfig({
  site: isGithubPages ? 'https://tomasdvoji.github.io' : process.env.URL,
  base: isGithubPages ? '/asistel' : '/',
});
