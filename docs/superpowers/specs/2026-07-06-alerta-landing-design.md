# Asistel s.r.o — landing page (design spec)

Datum: 2026-07-06
Stav: schváleno uživatelem (brainstorming dokončen)
Zdroj obsahu: `Dokument (12).docx` (texty převzaty doslova)
Vizuální předloha: Aceternity Spotlight — https://21st.dev/@aceternity/components/spotlight

## Kontext a rozhodnutí

- Asistel s.r.o je oficiální partner T-Mobile Czech Republic, síť 8 prodejen.
- Web **nahrazuje** rozdělaný Helion na této branchi (Helion zůstává v git historii).
- Rozsah: **všechno najednou** — landing + 3 podstránky.
- Mapa prodejen: **stylizovaná SVG mapa ČR** (bez závislostí a API klíčů).
- Barevnost: **tmavý web + T-Mobile magenta akcent**.

## Technologie

Statické HTML + CSS + JS, bez buildu a bez závislostí (žádné CDN knihovny).

Soubory:
- `index.html` — hlavní landing
- `prodejny.html` — detail 8 prodejen
- `tym.html` — celý tým
- `album.html` — fotoalbum z teambuildingů
- `styles.css` — sdílené styly
- `script.js` — sdílený JS (menu, lightbox, drobné interakce)

## Vizuální jazyk

- Pozadí téměř černé (`#0a0a0f`), jemná tečkovaná/grid textura (à la `bg-grid-white/[0.02]` z předlohy).
- **Spotlight efekt** v hero: port Aceternity komponenty do čistého SVG + CSS — rozostřená bílá elipsa (gaussian blur ~150), natočená, animovaná (fade-in + posun, CSS keyframes). Respektuje `prefers-reduced-motion`.
- Nadpisy: gradient text bílá → šedá (`background-clip: text`), tučné, velké (4xl–7xl ekvivalent).
- Akcentní barva: T-Mobile magenta `#E20074` — primární tlačítka, body na mapě, ikony, hover stavy, drobné akcenty.
- Ikony služeb: inline SVG line ikony (ne emoji z dokumentu).
- Karty/sekce: tmavé plochy s jemným ohraničením (`rgba(255,255,255,0.08)`), decentní hover (zvednutí/glow).
- Písmo: Inter z Google Fonts (weights 400/600/800) se systémovým sans fallbackem.

## Landing — sekce (v tomto pořadí)

Pořadí je záměrně přeskládané oproti číslování v dokumentu: kariéra jde na konec
jako závěrečná CTA, tým a teambuildingy na sebe navazují.

1. **Navigace** — logo „Asistel" (text), kotvy: Prodejny, Služby, Tým, Kariéra; mobilní hamburger.
2. **Hero (Spotlight)** — H1 „Telefonní svět bez starostí." (gradient), podtext:
   „Jsme tu pro vás na každém kroku – od výběru telefonu přes nastavení tarifu až po reklamaci. Vše pod jednou střechou."
   CTA: „Naše prodejny" (magenta, → prodejny.html) + „Naše služby" (ghost, → #sluzby).
3. **Prodejny** — dvousloupcová sekce:
   - SVG mapa ČR (obrys) s 8 svítícími magenta body: Jablonec nad Nisou, Mladá Boleslav, Teplice, Praha‑Hostivař, Litoměřice, Písek, Klatovy, Praha‑Dejvice. Body klikatelné → `prodejny.html#<slug>`. Tooltip s názvem města na hover/focus.
   - Text: „Asistel s.r.o je oficiálním partnerem T-Mobile Czech Republic. Provozujeme síť partnerských prodejen po celé České republice…" + „Nejsme jen obchod. Jsme tým lidí…" + tlačítko „Naše prodejny".
4. **Služby** — grid 6 karet (texty doslova z dokumentu):
   Telefony / Internet / Televize / Tarify / Příslušenství / Reklamace a servis.
5. **Tým** — „Za každou prodejnou stojí skuteční lidé." + text z dokumentu; 4 hlavní členové (placeholder foto, jméno, specializace) + tlačítko „Celý tým" → tym.html.
6. **Teambuildingy** — „Rádi se potkáváme i mimo práci." + text z dokumentu; náhled 3–4 fotek (placeholder) + tlačítko → album.html.
7. **Kariéra (CTA sekce)** — „Chceš dělat práci, která má smysl?" + oba odstavce z dokumentu; výrazné tlačítko „Volná místa" → externí inzerát:
   https://www.prace.cz/nabidka/694781be-ed2d-4bd5-8891-c73213b3a4b1/?rps=2077 (nové okno, `rel="noopener"`).
8. **Footer** — logo, „Oficiální partner T-Mobile Czech Republic", odkazy na podstránky, © Asistel s.r.o.

## Podstránky

Všechny sdílejí navigaci (s odkazem zpět na landing), tmavý vizuál (bez velkého spotlight hero — jen menší page-header varianta) a footer.

### prodejny.html
- Karta pro každou z 8 prodejen: foto (stylový placeholder — fotky z Googlu se dodají později), název města, adresa, otevírací doba.
- Telefony se zatím **neuvádějí** (dle dokumentu, dodají se později).
- Adresy a otevírací doby: věrohodné placeholdery označené `<!-- TODO: doplnit reálná data -->`.
- Každá karta má `id` (slug města) pro prokliky z mapy.

### tym.html
- Grid celého týmu (~12 osob): placeholder foto, jméno, co dělá / která prodejna.
- Placeholder jména označená TODO.

### album.html
- Fotogrid z teambuildingů (placeholder obrázky), jednoduchý lightbox (vanilla JS, zavírání Esc/klik mimo, ovladatelný klávesnicí).

## Interakce a chování (script.js)

- Mobilní menu toggle (aria-expanded, zavření Esc).
- Lightbox v albu.
- Smooth scroll na kotvy.
- Vše musí fungovat i bez JS (menu fallback, odkazy fungují normálně).

## Přístupnost a kvalita

- Sémantické HTML (header/nav/main/section/footer, h1–h3 hierarchie).
- Kontrast textu na tmavém pozadí min. AA; magenta se nepoužívá na dlouhý text.
- `prefers-reduced-motion`: vypne animaci spotlightu a hover pohyby.
- Responzivní: mobil (~360px) až desktop; mapa se na mobilu zmenší nebo nahradí seznamem měst.
- Alt texty u všech obrázků/placeholderů.

## Chybějící data (placeholdery)

Fotky prodejen, telefony, adresy, otevírací doby, jména a fotky týmu, fotky z teambuildingů — vše placeholder s komentářem `TODO: doplnit reálná data`. Struktura připravená tak, aby šla data doplnit bez zásahu do layoutu.

## Mimo rozsah

- CMS, formuláře, backend, analytika, cookie lišta.
- Reálná mapová knihovna (Leaflet/Google) — zamítnuto ve prospěch SVG.
