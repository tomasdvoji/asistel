// Fotky nahrané přes Decap CMS mají cesty od kořene (/uploads/...).
// Na GitHub Pages běží web pod /asistel, takže je potřeba doplnit base.
const raw = import.meta.env.BASE_URL;
const base = raw.endsWith('/') ? raw.slice(0, -1) : raw;

export const media = (src: string | undefined): string | undefined =>
  src && src.startsWith('/') && !src.startsWith('//') ? base + src : src;
