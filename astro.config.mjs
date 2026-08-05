import { defineConfig } from 'astro/config';

// Web běží na vlastní doméně asistel.cz (GitHub Pages s CNAME), všude v kořeni.
export default defineConfig({
  site: 'https://www.asistel.cz',
  base: '/',
});
