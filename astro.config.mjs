import { defineConfig } from 'astro/config';

// Web běží na vlastní doméně asistel.alerta.cz (GitHub Pages s CNAME), všude v kořeni.
export default defineConfig({
  site: 'https://asistel.alerta.cz',
  base: '/',
});
