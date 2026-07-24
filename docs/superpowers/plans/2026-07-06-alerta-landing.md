# Asistel Landing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Postavit web Asistel s.r.o (T-Mobile partner) — landing + 3 podstránky — v tmavém Spotlight stylu, nahrazuje Helion na branchi `helion-landing`.

**Architecture:** Statické HTML + CSS + JS bez buildu a bez závislostí. Sdílené `styles.css` a `script.js` pro všechny 4 stránky. Spotlight efekt = inline SVG (blur elipsa) + CSS keyframes, mapa ČR = inline SVG s klikatelnými body.

**Tech Stack:** HTML5, CSS3 (custom properties), vanilla JS, Google Fonts (Inter). Žádné knihovny.

**Spec:** `docs/superpowers/specs/2026-07-06-asistel-landing-design.md` — texty sekcí se berou DOSLOVA ze specu.

## Global Constraints

- Barvy: pozadí `#0a0a0f`, akcent T-Mobile magenta `#E20074`, ohraničení `rgba(255,255,255,0.08)`.
- Písmo: Inter 400/600/800 z Google Fonts, fallback `system-ui, sans-serif`.
- Žádné externí JS knihovny, žádné CDN skripty, žádná mapová API.
- Emoji z podkladového dokumentu se NEpoužívají — jen inline SVG ikony.
- Vše funkční bez JS (odkazy, obsah); JS jen vylepšuje (menu, lightbox).
- `prefers-reduced-motion: reduce` vypíná animace.
- Chybějící reálná data (adresy, hodiny, jména, fotky) = věrohodný placeholder + komentář `<!-- TODO: doplnit reálná data -->`.
- Telefony prodejen se NEuvádějí (dodají se později).
- Kontrast textu min. AA; magenta nikdy na dlouhý text.
- Commity po každém tasku, česky/anglicky prefix `feat:`/`fix:` jako dosud.
- Ověřování: Claude Preview tools (`preview_start` na statický server) — pokud `.claude/launch.json` neexistuje, vytvořit s `npx serve -l 3178 .`; pak `preview_snapshot`/`preview_screenshot`/`preview_console_logs`.

**Implementační skilly (uživatel na nich trvá):** při stavbě UI řídit se `taste-skill` (design-taste-frontend), `frontend-design`, `ui-ux-pro-max`; přístup ke kódu dle `ponytail` (nejjednodušší funkční řešení).

---

### Task 1: Reset repa + sdílený základ (tokeny, navigace, footer, menu JS)

**Files:**
- Modify (přepsat celé): `styles.css`, `script.js`, `index.html`
- Create: `.claude/launch.json` (pokud neexistuje)

**Interfaces:**
- Produces (CSS třídy pro všechny další tasky): `.container`, `.section`, `.section-head`, `.grad-text`, `.btn`, `.btn-primary`, `.btn-ghost`, `.card`, `.eyebrow`, `.site-nav`, `.site-footer`, `.nav-toggle`, `.nav-links`
- Produces (JS): menu toggle na `[data-nav-toggle]` / `[data-nav-links]`
- Produces (HTML kostra): `index.html` s `<header>` (nav), prázdným `<main id="main">`, footerem

- [ ] **Step 1: Přepsat `styles.css` základem** (celý obsah nahradit):

```css
/* ========== Asistel — design tokens & base ========== */
:root {
  --bg: #0a0a0f;
  --bg-raised: #11111a;
  --text: #ededf2;
  --text-dim: #a3a3b2;
  --accent: #E20074;
  --accent-soft: rgba(226, 0, 116, 0.14);
  --border: rgba(255, 255, 255, 0.08);
  --radius: 14px;
  --container: 1120px;
  --font: "Inter", system-ui, -apple-system, "Segoe UI", sans-serif;
}

* { box-sizing: border-box; margin: 0; padding: 0; }

html { scroll-behavior: smooth; }

body {
  font-family: var(--font);
  background: var(--bg);
  color: var(--text);
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}

img, svg { display: block; max-width: 100%; }

a { color: inherit; }

.container {
  max-width: var(--container);
  margin-inline: auto;
  padding-inline: 24px;
}

.section { padding-block: 96px; }

.section-head { max-width: 640px; margin-bottom: 48px; }

.eyebrow {
  display: inline-block;
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--accent);
  margin-bottom: 12px;
}

h1, h2, h3 { font-weight: 800; line-height: 1.15; letter-spacing: -0.02em; }
h2 { font-size: clamp(1.75rem, 4vw, 2.5rem); margin-bottom: 16px; }
h3 { font-size: 1.15rem; font-weight: 600; }

.grad-text {
  background: linear-gradient(to bottom, #fafafa, #a3a3b2);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.muted { color: var(--text-dim); }

/* ---------- buttons ---------- */
.btn {
  display: inline-block;
  padding: 12px 28px;
  border-radius: 999px;
  font-weight: 600;
  font-size: 0.95rem;
  text-decoration: none;
  transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
}
.btn:hover { transform: translateY(-1px); }
.btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }

.btn-primary {
  background: var(--accent);
  color: #fff;
}
.btn-primary:hover { box-shadow: 0 6px 24px rgba(226, 0, 116, 0.35); }

.btn-ghost {
  border: 1px solid var(--border);
  color: var(--text);
}
.btn-ghost:hover { background: rgba(255, 255, 255, 0.06); }

/* ---------- cards ---------- */
.card {
  background: var(--bg-raised);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 28px;
  transition: transform 0.15s ease, border-color 0.15s ease;
}
.card:hover { transform: translateY(-3px); border-color: rgba(226, 0, 116, 0.35); }

/* ---------- nav ---------- */
.site-nav {
  position: sticky;
  top: 0;
  z-index: 50;
  background: rgba(10, 10, 15, 0.8);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border);
}
.site-nav .container {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 64px;
}
.logo {
  font-weight: 800;
  font-size: 1.2rem;
  letter-spacing: -0.02em;
  text-decoration: none;
}
.logo span { color: var(--accent); }

.nav-links { display: flex; gap: 28px; list-style: none; }
.nav-links a {
  text-decoration: none;
  font-size: 0.92rem;
  color: var(--text-dim);
  transition: color 0.15s ease;
}
.nav-links a:hover, .nav-links a:focus-visible { color: var(--text); }

.nav-toggle {
  display: none;
  background: none;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 8px 10px;
  color: var(--text);
  cursor: pointer;
}

@media (max-width: 720px) {
  .nav-toggle { display: block; }
  .nav-links {
    display: none;
    position: absolute;
    top: 64px;
    left: 0;
    right: 0;
    flex-direction: column;
    gap: 0;
    background: var(--bg-raised);
    border-bottom: 1px solid var(--border);
    padding: 12px 24px;
  }
  .nav-links.open { display: flex; }
  .nav-links a { display: block; padding: 12px 0; }
}

/* ---------- footer ---------- */
.site-footer {
  border-top: 1px solid var(--border);
  padding-block: 48px;
  color: var(--text-dim);
  font-size: 0.9rem;
}
.site-footer .container {
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
  justify-content: space-between;
  align-items: center;
}
.site-footer ul { display: flex; gap: 20px; list-style: none; flex-wrap: wrap; }
.site-footer a { text-decoration: none; }
.site-footer a:hover { color: var(--text); }

/* ---------- motion ---------- */
@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  *, *::before, *::after { animation: none !important; transition: none !important; }
}
```

- [ ] **Step 2: Přepsat `script.js`** (celý obsah nahradit):

```js
// Asistel — shared interactions
(function () {
  "use strict";

  // Mobile nav toggle
  var toggle = document.querySelector("[data-nav-toggle]");
  var links = document.querySelector("[data-nav-links]");
  if (toggle && links) {
    toggle.addEventListener("click", function () {
      var open = links.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && links.classList.contains("open")) {
        links.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
        toggle.focus();
      }
    });
  }
})();
```

- [ ] **Step 3: Přepsat `index.html` kostrou** (celý obsah nahradit; sekce doplní další tasky do `<main>`):

```html
<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Asistel s.r.o — Telefonní svět bez starostí</title>
  <meta name="description" content="Asistel s.r.o je oficiálním partnerem T-Mobile Czech Republic. Tarify, telefony, internet i příslušenství — vše pod jednou střechou.">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <header class="site-nav">
    <div class="container">
      <a class="logo" href="index.html">Asistel<span>.</span></a>
      <button class="nav-toggle" type="button" data-nav-toggle aria-expanded="false" aria-controls="nav-links" aria-label="Otevřít menu">☰</button>
      <ul class="nav-links" id="nav-links" data-nav-links>
        <li><a href="#prodejny">Prodejny</a></li>
        <li><a href="#sluzby">Služby</a></li>
        <li><a href="#tym">Tým</a></li>
        <li><a href="#kariera">Kariéra</a></li>
      </ul>
    </div>
  </header>

  <main id="main">
    <!-- sekce doplní tasky 2–6 -->
  </main>

  <footer class="site-footer">
    <div class="container">
      <div>
        <a class="logo" href="index.html">Asistel<span>.</span></a>
        <p>Oficiální partner T-Mobile Czech Republic</p>
      </div>
      <ul>
        <li><a href="prodejny.html">Prodejny</a></li>
        <li><a href="tym.html">Tým</a></li>
        <li><a href="album.html">Fotoalbum</a></li>
        <li><a href="https://www.prace.cz/nabidka/694781be-ed2d-4bd5-8891-c73213b3a4b1/?rps=2077" target="_blank" rel="noopener">Kariéra</a></li>
      </ul>
      <p>© 2026 Asistel s.r.o</p>
    </div>
  </footer>

  <script src="script.js"></script>
</body>
</html>
```

- [ ] **Step 4: Zajistit `.claude/launch.json`** — pokud neexistuje, vytvořit:

```json
{
  "version": "0.0.1",
  "configurations": [
    { "name": "asistel", "runtimeExecutable": "npx", "runtimeArgs": ["-y", "serve", "-l", "3178", "."], "port": 3178 }
  ]
}
```

- [ ] **Step 5: Ověřit v preview** — `preview_start` (name: `asistel`), pak `preview_snapshot`: stránka má nav s logem „Asistel." a 4 odkazy, footer s odkazy, žádné chyby v `preview_console_logs`. Na mobilní šířce (`preview_resize` mobile) se ukáže hamburger; `preview_click` na něj otevře menu (snapshot potvrdí odkazy).

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: asistel scaffold - tokens, nav, footer, menu toggle (replaces helion)"
```

---

### Task 2: Hero se Spotlight efektem

**Files:**
- Modify: `index.html` (do `<main>`, jako první sekce), `styles.css` (append)

**Interfaces:**
- Consumes: `.container`, `.grad-text`, `.btn`, `.btn-primary`, `.btn-ghost` z Tasku 1
- Produces: sekce `.hero` s `#uvod`

- [ ] **Step 1: Vložit hero HTML** na začátek `<main>`:

```html
    <section class="hero" id="uvod">
      <svg class="spotlight" viewBox="0 0 3787 2842" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <g filter="url(#spotlight-blur)">
          <ellipse cx="1924.71" cy="273.501" rx="1924.71" ry="273.501"
            transform="matrix(-0.822377 -0.568943 -0.568943 0.822377 3631.88 2291.09)"
            fill="white" fill-opacity="0.21"></ellipse>
        </g>
        <defs>
          <filter id="spotlight-blur" x="0.86" y="0.84" width="3785.16" height="2840.26"
            filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
            <feFlood flood-opacity="0" result="BackgroundImageFix"></feFlood>
            <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"></feBlend>
            <feGaussianBlur stdDeviation="151" result="blur"></feGaussianBlur>
          </filter>
        </defs>
      </svg>
      <div class="container hero-inner">
        <h1 class="grad-text">Telefonní svět bez&nbsp;starostí.</h1>
        <p class="hero-sub">Jsme tu pro vás na každém kroku – od výběru telefonu přes nastavení tarifu až po reklamaci. Vše pod jednou střechou.</p>
        <div class="hero-cta">
          <a class="btn btn-primary" href="prodejny.html">Naše prodejny</a>
          <a class="btn btn-ghost" href="#sluzby">Naše služby</a>
        </div>
      </div>
    </section>
```

- [ ] **Step 2: Připsat hero CSS** na konec `styles.css`:

```css
/* ---------- hero (Aceternity Spotlight port) ---------- */
.hero {
  position: relative;
  overflow: hidden;
  min-height: 88vh;
  display: flex;
  align-items: center;
  background-image: radial-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px);
  background-size: 34px 34px;
}
.spotlight {
  position: absolute;
  top: -40%;
  left: -10%;
  width: 138%;
  height: 169%;
  pointer-events: none;
  z-index: 1;
  opacity: 0;
  animation: spotlight 2s ease 0.75s 1 forwards;
}
@keyframes spotlight {
  0%   { opacity: 0; transform: translate(-72%, -62%) scale(0.5); }
  100% { opacity: 1; transform: translate(-50%, -40%) scale(1); }
}
@media (min-width: 1024px) { .spotlight { width: 84%; left: 20%; } }

.hero-inner { position: relative; z-index: 2; text-align: center; padding-block: 96px; }
.hero h1 { font-size: clamp(2.5rem, 7vw, 4.5rem); max-width: 16ch; margin-inline: auto; }
.hero-sub {
  margin: 20px auto 0;
  max-width: 34rem;
  color: var(--text-dim);
  font-size: 1.05rem;
}
.hero-cta { margin-top: 36px; display: flex; gap: 14px; justify-content: center; flex-wrap: wrap; }

@media (prefers-reduced-motion: reduce) {
  .spotlight { opacity: 1; transform: translate(-50%, -40%); }
}
```

- [ ] **Step 3: Ověřit v preview** — reload; `preview_screenshot`: tmavé hero s kuželem světla zleva shora, gradient nadpis „Telefonní svět bez starostí.", dvě CTA. `preview_inspect` na `.hero h1` potvrdí `background-clip: text`. Konzole bez chyb.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: spotlight hero"
```

---

### Task 3: Sekce Prodejny se SVG mapou ČR

**Files:**
- Modify: `index.html` (za hero), `styles.css` (append)

**Interfaces:**
- Consumes: `.section`, `.eyebrow`, `.btn-primary`, `.muted`
- Produces: `#prodejny`; sluggy prodejen používané v Tasku 7: `jablonec`, `mlada-boleslav`, `teplice`, `hostivar`, `litomerice`, `pisek`, `klatovy`, `dejvice`

- [ ] **Step 1: Vložit HTML sekce** za hero. Mapa: obrys ČR + 8 bodů `<a>` s `xlink` nahrazeným moderním `href` (SVG2 `<a href>` funguje ve všech moderních prohlížečích):

```html
    <section class="section" id="prodejny">
      <div class="container split">
        <div class="map-wrap">
          <svg class="cz-map" viewBox="0 0 600 350" role="img" aria-label="Mapa prodejen Asistel v České republice">
            <path class="cz-outline" d="M0,113 L21,124 L41,61 L83,77 L116,63 L156,46 L204,22 L197,1 L257,8 L283,25 L306,39 L348,64 L386,67 L365,89 L409,134 L499,103 L527,138 L574,158 L599,215 L538,251 L493,308 L452,305 L430,340 L394,314 L352,322 L272,296 L231,346 L173,343 L126,291 L48,223 L27,183 L41,159 Z"/>
            <!-- body prodejen: cx/cy dle skutečné polohy měst -->
            <a href="prodejny.html#jablonec"><circle class="shop-dot" cx="273" cy="47" r="7"><title>Jablonec nad Nisou</title></circle></a>
            <a href="prodejny.html#mlada-boleslav"><circle class="shop-dot" cx="249" cy="91" r="7"><title>Mladá Boleslav</title></circle></a>
            <a href="prodejny.html#teplice"><circle class="shop-dot" cx="154" cy="59" r="7"><title>Teplice</title></circle></a>
            <a href="prodejny.html#litomerice"><circle class="shop-dot" cx="181" cy="74" r="7"><title>Litoměřice</title></circle></a>
            <a href="prodejny.html#dejvice"><circle class="shop-dot" cx="204" cy="134" r="7"><title>Praha-Dejvice</title></circle></a>
            <a href="prodejny.html#hostivar"><circle class="shop-dot" cx="216" cy="141" r="7"><title>Praha-Hostivař</title></circle></a>
            <a href="prodejny.html#pisek"><circle class="shop-dot" cx="182" cy="244" r="7"><title>Písek</title></circle></a>
            <a href="prodejny.html#klatovy"><circle class="shop-dot" cx="107" cy="232" r="7"><title>Klatovy</title></circle></a>
          </svg>
          <p class="map-note muted">8 prodejen po celé České republice</p>
        </div>
        <div>
          <span class="eyebrow">Prodejny</span>
          <h2 class="grad-text">Síť prodejen po celé republice</h2>
          <p>Asistel s.r.o je oficiálním partnerem T-Mobile Czech Republic. Provozujeme síť partnerských prodejen po celé České republice, kde zákazníkům nabízíme kompletní produkty a služby T-Mobile – tarify, telefony, internet i příslušenství.</p>
          <p class="muted" style="margin-top:12px">Nejsme jen obchod. Jsme tým lidí, kterým záleží na tom, aby odcházel každý zákazník spokojený. Jednoduše, lidsky, bez technického žargonu.</p>
          <p style="margin-top:28px"><a class="btn btn-primary" href="prodejny.html">Naše prodejny</a></p>
        </div>
      </div>
    </section>
```

- [ ] **Step 2: Připsat CSS**:

```css
/* ---------- prodejny / mapa ---------- */
.split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 64px;
  align-items: center;
}
@media (max-width: 880px) { .split { grid-template-columns: 1fr; gap: 40px; } }

.cz-outline {
  fill: rgba(255, 255, 255, 0.03);
  stroke: var(--border);
  stroke-width: 1.5;
  stroke-linejoin: round;
}
.shop-dot {
  fill: var(--accent);
  cursor: pointer;
  transition: r 0.15s ease;
  filter: drop-shadow(0 0 6px rgba(226, 0, 116, 0.9));
}
.cz-map a:hover .shop-dot, .cz-map a:focus .shop-dot { r: 10; }
.cz-map a:focus { outline: none; }
.cz-map a:focus .shop-dot { stroke: #fff; stroke-width: 2; }
.map-note { margin-top: 12px; font-size: 0.85rem; text-align: center; }
```

- [ ] **Step 3: Ověřit v preview** — snapshot: sekce má nadpis, oba odstavce, tlačítko. Screenshot: obrys připomíná ČR, 8 magenta svítících bodů zhruba na správných místech (Praha ~střed-západ, Písek/Klatovy jih-západ, Jablonec sever-východ). Hover nad bodem jej zvětší. Klik vede na `prodejny.html#slug` (zatím 404 souboru — OK, vznikne v Tasku 7).

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: prodejny section with svg map"
```

---

### Task 4: Sekce Služby (6 karet)

**Files:**
- Modify: `index.html` (za #prodejny), `styles.css` (append)

**Interfaces:**
- Consumes: `.section`, `.card`, `.eyebrow`, `.section-head`
- Produces: `#sluzby`

- [ ] **Step 1: Vložit HTML.** Texty doslova z dokumentu. Ikony = inline SVG 24×24, stroke `currentColor` (kreslí se magenta přes `.svc-icon`). První karta kompletně, dalších 5 stejnou šablonou s daty z tabulky níže:

```html
    <section class="section" id="sluzby">
      <div class="container">
        <div class="section-head">
          <span class="eyebrow">Služby</span>
          <h2 class="grad-text">Vše pod jednou střechou</h2>
        </div>
        <div class="svc-grid">
          <article class="card">
            <div class="svc-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="2" width="10" height="20" rx="2"/><line x1="11" y1="18" x2="13" y2="18"/></svg>
            </div>
            <h3>Telefony</h3>
            <p class="muted">Pomůžeme vybrat ten správný – podle potřeb, rozpočtu i zvyku.</p>
          </article>
          <!-- + 5 dalších karet dle tabulky -->
        </div>
      </div>
    </section>
```

| h3 | text (doslova) | SVG ikona (obsah `<svg>` se stejnými atributy jako výše) |
|---|---|---|
| Internet | Mobilní i domácí internet. Nastavíme, vysvětlíme, spustíme. | `<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/>` |
| Televize | Televizní balíčky T-Mobile – poradíme, co se hodí právě vám. | `<rect x="2" y="6" width="20" height="13" rx="2"/><path d="m9 2 3 4 3-4"/>` |
| Tarify | Nový tarif, změna, přenos čísla – vyřešíme vše na místě. | `<path d="M4 4h16v16H4z"/><path d="M8 9h8M8 13h6"/>` |
| Příslušenství | Obaly, skla, nabíječky, sluchátka – vše po ruce. | `<path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1v-6h3zM3 19a2 2 0 0 0 2 2h1v-6H3z"/>` |
| Reklamace a servis | Něco se pokazilo? Vyřídíme to za vás, bez stresu. | `<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>` |

- [ ] **Step 2: Připsat CSS**:

```css
/* ---------- služby ---------- */
.svc-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}
@media (max-width: 880px) { .svc-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 560px) { .svc-grid { grid-template-columns: 1fr; } }

.svc-icon {
  width: 46px;
  height: 46px;
  display: grid;
  place-items: center;
  border-radius: 12px;
  background: var(--accent-soft);
  color: var(--accent);
  margin-bottom: 16px;
}
.svc-grid h3 { margin-bottom: 6px; }
```

- [ ] **Step 3: Ověřit v preview** — snapshot: 6 karet s přesnými texty z dokumentu. Screenshot: 3 sloupce na desktopu, magenta ikony; na mobilu 1 sloupec.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: services section"
```

---

### Task 5: Sekce Tým + Teambuildingy

**Files:**
- Modify: `index.html` (za #sluzby), `styles.css` (append)

**Interfaces:**
- Consumes: `.section`, `.card`, `.eyebrow`, `.btn-ghost`, `.split`
- Produces: `#tym`, `#teambuildingy`; třída `.avatar` (použije i Task 8)

- [ ] **Step 1: Vložit HTML obou sekcí.** Placeholder členové (TODO data). Avatar = div s iniciálami (žádné obrázky):

```html
    <section class="section" id="tym">
      <div class="container">
        <div class="section-head">
          <span class="eyebrow">Tým</span>
          <h2 class="grad-text">Za každou prodejnou stojí skuteční lidé.</h2>
          <p class="muted">Nejsme bezejmenné call centrum. Jsme tým konkrétních lidí – každý se jménem, svou specializací a svými zákazníky, které zná. Podívejte se, kdo stojí za Asistelem.</p>
        </div>
        <div class="team-grid">
          <!-- TODO: doplnit reálná data (jména, role, fotky) -->
          <article class="card team-card">
            <div class="avatar" aria-hidden="true">PN</div>
            <h3>Petr Novák</h3>
            <p class="muted">Vedoucí prodejny · Praha-Dejvice</p>
          </article>
          <article class="card team-card">
            <div class="avatar" aria-hidden="true">JS</div>
            <h3>Jana Svobodová</h3>
            <p class="muted">Specialistka na tarify · Teplice</p>
          </article>
          <article class="card team-card">
            <div class="avatar" aria-hidden="true">MD</div>
            <h3>Martin Dvořák</h3>
            <p class="muted">Servis a reklamace · Mladá Boleslav</p>
          </article>
          <article class="card team-card">
            <div class="avatar" aria-hidden="true">LK</div>
            <h3>Lucie Králová</h3>
            <p class="muted">Internet a televize · Písek</p>
          </article>
        </div>
        <p style="margin-top:32px;text-align:center"><a class="btn btn-ghost" href="tym.html">Celý tým</a></p>
      </div>
    </section>

    <section class="section" id="teambuildingy">
      <div class="container split">
        <div>
          <span class="eyebrow">Teambuildingy</span>
          <h2 class="grad-text">Rádi se potkáváme i&nbsp;mimo práci.</h2>
          <p class="muted">Teambuildingy, firemní výlety nebo jen společná večeře – pravidelně vyrážíme ven jako tým. Věříme, že dobrá parta dělá dobrou práci, a proto investujeme do akcí, kde si každý odpočine, zasměje se a lépe pozná své kolegy.</p>
          <p style="margin-top:28px"><a class="btn btn-ghost" href="album.html">Fotoalbum</a></p>
        </div>
        <div class="tb-preview" aria-hidden="true">
          <!-- TODO: doplnit reálné fotky -->
          <div class="tb-tile"></div>
          <div class="tb-tile"></div>
          <div class="tb-tile"></div>
          <div class="tb-tile"></div>
        </div>
      </div>
    </section>
```

- [ ] **Step 2: Připsat CSS**:

```css
/* ---------- tým ---------- */
.team-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
}
@media (max-width: 880px) { .team-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 480px) { .team-grid { grid-template-columns: 1fr; } }

.team-card { text-align: center; }
.avatar {
  width: 72px;
  height: 72px;
  margin: 0 auto 14px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-weight: 800;
  font-size: 1.1rem;
  color: #fff;
  background: linear-gradient(135deg, #3a3a4a, #1c1c28);
  border: 1px solid var(--border);
}
.team-card h3 { font-size: 1rem; }
.team-card p { font-size: 0.85rem; }

/* ---------- teambuildingy ---------- */
.tb-preview {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}
.tb-tile {
  aspect-ratio: 4 / 3;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background:
    radial-gradient(circle at 30% 30%, rgba(226, 0, 116, 0.18), transparent 60%),
    var(--bg-raised);
}
.tb-tile:nth-child(2) { background: radial-gradient(circle at 70% 40%, rgba(226, 0, 116, 0.12), transparent 60%), var(--bg-raised); }
.tb-tile:nth-child(3) { background: radial-gradient(circle at 40% 70%, rgba(255, 255, 255, 0.06), transparent 60%), var(--bg-raised); }
```

- [ ] **Step 3: Ověřit v preview** — snapshot: nadpisy a texty obou sekcí doslova dle specu, 4 členové týmu, tlačítka „Celý tým" a „Fotoalbum". Screenshot: avatary s iniciálami, 4 dlaždice náhledu.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: team and teambuilding sections"
```

---

### Task 6: Kariéra CTA sekce

**Files:**
- Modify: `index.html` (za #teambuildingy, poslední sekce v `<main>`), `styles.css` (append)

**Interfaces:**
- Consumes: `.section`, `.btn-primary`, `.eyebrow`
- Produces: `#kariera`

- [ ] **Step 1: Vložit HTML**:

```html
    <section class="section" id="kariera">
      <div class="container">
        <div class="career-panel">
          <span class="eyebrow">Kariéra</span>
          <h2 class="grad-text">Chceš dělat práci, která má smysl?</h2>
          <p>U nás neřešíš jenom tarify. Pomáháš lidem se vším – od výběru nového telefonu a nastavení domácího internetu přes televizní balíčky a příslušenství až po reklamace a přenos čísla. Vyřešíš seniorce problém s telefonem, poradíš mladému tatínkovi první smartphone pro dítě, nebo jen nalepíš sklo a zákazník odchází s úsměvem.</p>
          <p class="muted" style="margin-top:12px">Jsme tým, který táhne za jeden provaz. Ambiciózní, ale lidský. Hledáme kolegy, kteří si rozumějí se zákazníky i mezi sebou.</p>
          <p style="margin-top:32px"><a class="btn btn-primary" href="https://www.prace.cz/nabidka/694781be-ed2d-4bd5-8891-c73213b3a4b1/?rps=2077" target="_blank" rel="noopener">Volná místa</a></p>
        </div>
      </div>
    </section>
```

- [ ] **Step 2: Připsat CSS**:

```css
/* ---------- kariéra ---------- */
.career-panel {
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: clamp(32px, 6vw, 72px);
  text-align: center;
  background:
    radial-gradient(ellipse at 50% -20%, rgba(226, 0, 116, 0.16), transparent 60%),
    var(--bg-raised);
}
.career-panel p { max-width: 46rem; margin-inline: auto; }
```

- [ ] **Step 3: Ověřit v preview** — snapshot: oba odstavce doslova, tlačítko „Volná místa" s `target="_blank"` a `rel="noopener"` (ověřit v inspect/snapshot). Screenshot: panel s magenta září shora.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: career cta section"
```

---

### Task 7: prodejny.html

**Files:**
- Create: `prodejny.html`
- Modify: `styles.css` (append)

**Interfaces:**
- Consumes: nav/footer markup z Tasku 1 (zkopírovat, na podstránkách odkazy v nav vedou na `index.html#...`), `.card`, `.section`
- Produces: karty s `id`: `jablonec`, `mlada-boleslav`, `teplice`, `hostivar`, `litomerice`, `pisek`, `klatovy`, `dejvice` (musí sedět s odkazy mapy z Tasku 3)

- [ ] **Step 1: Vytvořit `prodejny.html`.** Stejný `<head>` (title „Naše prodejny — Asistel s.r.o"), stejný header/footer jako index, ale `.nav-links` odkazy: `index.html#prodejny`, `index.html#sluzby`, `index.html#tym`, `index.html#kariera`. Obsah `<main>` — page header + grid; první karta kompletně, dalších 7 stejnou šablonou s daty z tabulky:

```html
  <main id="main">
    <section class="section page-head">
      <div class="container">
        <span class="eyebrow">Prodejny</span>
        <h1 class="grad-text">Naše prodejny</h1>
        <p class="muted">8 prodejen po celé České republice. Přijďte – poradíme vám osobně.</p>
      </div>
    </section>
    <section class="section" style="padding-top:0">
      <div class="container">
        <div class="shops-grid">
          <!-- TODO: doplnit reálná data (fotky z Googlu, přesné adresy, otevírací doby; telefony se dodají později) -->
          <article class="card shop-card" id="jablonec">
            <div class="shop-photo" role="img" aria-label="Fotografie prodejny Jablonec nad Nisou — bude doplněna"><span>Jablonec nad Nisou</span></div>
            <h3>Jablonec nad Nisou</h3>
            <p class="muted">Mírové náměstí 12, 466 01 Jablonec nad Nisou</p>
            <p class="shop-hours">Po–Pá 9:00–17:30 · So 9:00–12:00</p>
          </article>
          <!-- + 7 dalších karet dle tabulky -->
        </div>
      </div>
    </section>
  </main>
```

| id | h3 | adresa (placeholder, TODO) | hodiny (placeholder, TODO) |
|---|---|---|---|
| mlada-boleslav | Mladá Boleslav | Staroměstské náměstí 8, 293 01 Mladá Boleslav | Po–Pá 9:00–18:00 · So 9:00–12:00 |
| teplice | Teplice | Benešovo náměstí 5, 415 01 Teplice | Po–Pá 9:00–17:30 |
| hostivar | Praha-Hostivař | Švehlova 1391/32, 102 00 Praha 10 | Po–Pá 9:00–19:00 · So 9:00–14:00 |
| litomerice | Litoměřice | Mírové náměstí 21, 412 01 Litoměřice | Po–Pá 9:00–17:00 |
| pisek | Písek | Velké náměstí 14, 397 01 Písek | Po–Pá 9:00–17:00 · So 9:00–11:30 |
| klatovy | Klatovy | Náměstí Míru 9, 339 01 Klatovy | Po–Pá 9:00–17:00 |
| dejvice | Praha-Dejvice | Vítězné náměstí 2, 160 00 Praha 6 | Po–Pá 9:00–19:00 · So 9:00–14:00 |

- [ ] **Step 2: Připsat CSS**:

```css
/* ---------- podstránky ---------- */
.page-head { padding-bottom: 24px; }
.page-head h1 { font-size: clamp(2rem, 5vw, 3rem); }

.shops-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}
@media (max-width: 880px) { .shops-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 560px) { .shops-grid { grid-template-columns: 1fr; } }

.shop-card { scroll-margin-top: 90px; padding: 0; overflow: hidden; }
.shop-card h3 { padding: 18px 22px 0; }
.shop-card p { padding: 4px 22px 0; font-size: 0.9rem; }
.shop-card .shop-hours { padding-bottom: 22px; color: var(--accent); font-weight: 600; font-size: 0.85rem; }
.shop-photo {
  aspect-ratio: 16 / 10;
  display: grid;
  place-items: center;
  background:
    radial-gradient(circle at 50% 20%, rgba(226, 0, 116, 0.14), transparent 65%),
    linear-gradient(160deg, #191926, #0e0e16);
  border-bottom: 1px solid var(--border);
}
.shop-photo span { color: var(--text-dim); font-weight: 600; font-size: 0.9rem; }
```

- [ ] **Step 3: Ověřit v preview** — navigovat na `/prodejny.html`: 8 karet, každá má foto-placeholder, adresu, hodiny, žádné telefony. Otevřít `/prodejny.html#pisek` — stránka sroluje na kartu Písek (scroll-margin funguje). Z indexu klik na bod mapy vede správně.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: prodejny page"
```

---

### Task 8: tym.html

**Files:**
- Create: `tym.html`

**Interfaces:**
- Consumes: `.team-grid`, `.team-card`, `.avatar` z Tasku 5; nav/footer vzor podstránky z Tasku 7

- [ ] **Step 1: Vytvořit `tym.html`** — head (title „Náš tým — Asistel s.r.o"), header/footer jako v Tasku 7. Main: page-head („Za každou prodejnou stojí skuteční lidé." jako h1 + text z dokumentu) + `.team-grid` s 12 členy. Prvních 4 = stejní lidé jako na landing (Petr Novák PN, Jana Svobodová JS, Martin Dvořák MD, Lucie Králová LK, stejné role). Dalších 8 (vše `<!-- TODO: doplnit reálná data -->`):

| iniciály | jméno | role · prodejna |
|---|---|---|
| TH | Tomáš Horák | Prodejce · Jablonec nad Nisou |
| KV | Kateřina Veselá | Prodejkyně · Litoměřice |
| OP | Ondřej Pokorný | Vedoucí prodejny · Klatovy |
| AM | Alena Marková | Specialistka na příslušenství · Praha-Hostivař |
| DB | David Beneš | Prodejce · Teplice |
| VS | Veronika Šimková | Přenosy čísel · Mladá Boleslav |
| RK | Radek Kolář | Servis a reklamace · Praha-Dejvice |
| EN | Eva Nováková | Prodejkyně · Písek |

Markup karty identický s Taskem 5:

```html
          <article class="card team-card">
            <div class="avatar" aria-hidden="true">TH</div>
            <h3>Tomáš Horák</h3>
            <p class="muted">Prodejce · Jablonec nad Nisou</p>
          </article>
```

- [ ] **Step 2: Ověřit v preview** — `/tym.html`: h1, úvodní text, 12 karet, responsivní grid (4/2/1 sloupce). Konzole čistá.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: tym page"
```

---

### Task 9: album.html + lightbox

**Files:**
- Create: `album.html`
- Modify: `styles.css` (append), `script.js` (append)

**Interfaces:**
- Consumes: nav/footer vzor podstránky z Tasku 7
- Produces: lightbox aktivovaný na `[data-lightbox]` prvcích

- [ ] **Step 1: Vytvořit `album.html`** — head (title „Fotoalbum — Asistel s.r.o"), header/footer jako Task 7. Main: page-head („Rádi se potkáváme i mimo práci." h1 + text z dokumentu o teambuildinzích) + grid 9 placeholder dlaždic (TODO fotky). Dlaždice = `<button>` (klávesnicově přístupné):

```html
    <section class="section" style="padding-top:0">
      <div class="container">
        <div class="album-grid">
          <!-- TODO: doplnit reálné fotky z teambuildingů -->
          <button class="album-tile" type="button" data-lightbox aria-label="Zvětšit fotku 1"><span class="muted">Teambuilding 2025</span></button>
          <button class="album-tile" type="button" data-lightbox aria-label="Zvětšit fotku 2"><span class="muted">Firemní výlet</span></button>
          <button class="album-tile" type="button" data-lightbox aria-label="Zvětšit fotku 3"><span class="muted">Společná večeře</span></button>
          <button class="album-tile" type="button" data-lightbox aria-label="Zvětšit fotku 4"><span class="muted">Teambuilding 2025</span></button>
          <button class="album-tile" type="button" data-lightbox aria-label="Zvětšit fotku 5"><span class="muted">Vánoční večírek</span></button>
          <button class="album-tile" type="button" data-lightbox aria-label="Zvětšit fotku 6"><span class="muted">Letní grilovačka</span></button>
          <button class="album-tile" type="button" data-lightbox aria-label="Zvětšit fotku 7"><span class="muted">Firemní výlet</span></button>
          <button class="album-tile" type="button" data-lightbox aria-label="Zvětšit fotku 8"><span class="muted">Teambuilding 2024</span></button>
          <button class="album-tile" type="button" data-lightbox aria-label="Zvětšit fotku 9"><span class="muted">Bowling</span></button>
        </div>
      </div>
    </section>

    <div class="lightbox" id="lightbox" hidden>
      <div class="lightbox-body" role="dialog" aria-modal="true" aria-label="Náhled fotky">
        <div class="lightbox-content"></div>
        <button class="lightbox-close" type="button" aria-label="Zavřít">✕</button>
      </div>
    </div>
```

- [ ] **Step 2: Připsat CSS**:

```css
/* ---------- album + lightbox ---------- */
.album-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
}
@media (max-width: 720px) { .album-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 480px) { .album-grid { grid-template-columns: 1fr; } }

.album-tile {
  aspect-ratio: 4 / 3;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background:
    radial-gradient(circle at 35% 30%, rgba(226, 0, 116, 0.15), transparent 60%),
    var(--bg-raised);
  cursor: pointer;
  display: grid;
  place-items: center;
  font: inherit;
  transition: transform 0.15s ease, border-color 0.15s ease;
}
.album-tile:hover { transform: scale(1.02); border-color: rgba(226, 0, 116, 0.4); }
.album-tile:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }

.lightbox {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: rgba(0, 0, 0, 0.85);
  display: grid;
  place-items: center;
  padding: 24px;
}
.lightbox[hidden] { display: none; }
.lightbox-body { position: relative; width: min(880px, 100%); }
.lightbox-content {
  aspect-ratio: 4 / 3;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background:
    radial-gradient(circle at 35% 30%, rgba(226, 0, 116, 0.18), transparent 60%),
    var(--bg-raised);
  display: grid;
  place-items: center;
  color: var(--text-dim);
  font-weight: 600;
}
.lightbox-close {
  position: absolute;
  top: -14px;
  right: -14px;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 1px solid var(--border);
  background: var(--bg-raised);
  color: var(--text);
  cursor: pointer;
  font-size: 1rem;
}
```

- [ ] **Step 3: Připsat lightbox JS** na konec IIFE v `script.js` (před závěrečné `})();`):

```js
  // Lightbox (album)
  var lb = document.getElementById("lightbox");
  if (lb) {
    var lbContent = lb.querySelector(".lightbox-content");
    var lbClose = lb.querySelector(".lightbox-close");
    var lastFocused = null;

    function openLb(tile) {
      lastFocused = tile;
      lbContent.textContent = tile.textContent.trim();
      lb.hidden = false;
      lbClose.focus();
    }
    function closeLb() {
      lb.hidden = true;
      if (lastFocused) lastFocused.focus();
    }

    document.querySelectorAll("[data-lightbox]").forEach(function (tile) {
      tile.addEventListener("click", function () { openLb(tile); });
    });
    lbClose.addEventListener("click", closeLb);
    lb.addEventListener("click", function (e) { if (e.target === lb) closeLb(); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !lb.hidden) closeLb();
    });
  }
```

- [ ] **Step 4: Ověřit v preview** — `/album.html`: 9 dlaždic; klik otevře lightbox se stejným popiskem, ✕ i klik mimo i Esc zavírá, focus se vrací na dlaždici. Konzole čistá (i na indexu, kde lightbox není — guard `if (lb)`).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: album page with lightbox"
```

---

### Task 10: Finální průchod — přístupnost, responzivita, kontrola proti specu

**Files:**
- Modify: dle nálezů (`index.html`, `prodejny.html`, `tym.html`, `album.html`, `styles.css`)

**Interfaces:**
- Consumes: vše výše

- [ ] **Step 1: Projít spec sekci po sekci** (`docs/superpowers/specs/2026-07-06-asistel-landing-design.md`) a odškrtat: všechny texty doslova, pořadí sekcí (hero → prodejny → služby → tým → teambuildingy → kariéra), externí odkaz na prace.cz s `noopener`, TODO komentáře u všech placeholder dat, žádná emoji, žádné externí knihovny.

- [ ] **Step 2: Responzivní kontrola v preview** — `preview_resize` mobile (375px): hamburger menu funguje, hero čitelné, mapa se vejde (šířka 100 %), grids kolabují na 1 sloupec, nikde horizontální scroll (ověřit `preview_eval`: `document.documentElement.scrollWidth <= window.innerWidth`). Tablet (768px) a desktop (1280px) screenshoty.

- [ ] **Step 3: Reduced motion** — `preview_eval` s `matchMedia` emulací nejde; ověřit v CSS, že blok `@media (prefers-reduced-motion: reduce)` pokrývá `.spotlight` (viditelný bez animace) a globálně vypíná transitions.

- [ ] **Step 4: A11y kontrola** — snapshot všech 4 stránek: h1 právě jednou na stránku, landmarky header/main/footer, `aria-expanded` na toggle, alt/aria-label na SVG mapě a foto placeholderech, focus stavy viditelné (tab průchod přes `preview_eval` focus test na mapě a lightboxu).

- [ ] **Step 5: Opravit nálezy a commit**

```bash
git add -A && git commit -m "fix: a11y and responsive polish"
```

- [ ] **Step 6: Finální screenshot celé landing page** pro uživatele (desktop + mobil).
