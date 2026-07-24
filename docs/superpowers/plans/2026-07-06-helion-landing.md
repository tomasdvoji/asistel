# Helion Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Statická česká landing page pro Helion (instalace solárních panelů) s poptávkovým formulářem.

**Architecture:** Tři soubory bez build kroku — `index.html` (veškerý obsah), `styles.css` (mobile-first, CSS proměnné), `script.js` (menu, scroll, validace formuláře). Ověřování probíhá otevřením v prohlížeči (preview nástroje), ne unit testy — jde o statickou stránku bez logiky mimo formulář.

**Tech Stack:** HTML5, CSS3 (custom properties, grid/flex, clamp), vanilla JS. Google Fonts (jediná externí závislost, pouze CSS). Žádný framework, žádný build.

## Global Constraints

- Texty česky, firma se jmenuje „Helion", e-mail kontakt `info@helion.cz` (placeholder), IČO placeholder „12345678"
- Žádné externí JS závislosti; jediný externí zdroj: Google Fonts
- Funguje otevřením `index.html` přes `file://` (žádné fetch/moduly)
- Responzivní 360 px – 1440 px+
- Formulář: pouze frontend validace + potvrzení, bez backendu
- Design řídí taste-skill (design-taste-frontend): žádný šablonový AI vzhled

## Design direction (závazné tokeny)

- Fonty: **Space Grotesk** (nadpisy, 600/700) + **Inter** (text, 400/500) z Google Fonts
- Barvy: pozadí `#0A1520` (téměř černá modř), plochy `#101F2E`, text `#E8EDF2`, tlumený text `#8FA3B5`, akcent `#F5A623` (sluneční oranžová), akcent-hover `#FFBE4D`
- Světlé sekce: pozadí `#F4F1EA` (teplá slonovina), text `#12202E` — stránka střídá tmavé a světlé bloky, ne jedna barva dokola
- Typografická škála: hero `clamp(2.5rem, 7vw, 4.5rem)`, sekce `clamp(1.75rem, 4vw, 2.75rem)`, text `1.0625rem/1.65`
- Spacing: sekce `clamp(4rem, 10vh, 7.5rem)` vertikálně; obsah max-width `72rem`
- Rohy `12px` na kartách, žádné stíny-na-všem — hloubka přes kontrast ploch
- Obrázky: CSS gradient/SVG placeholdery (žádné externí obrázky), připravené na výměnu

---

### Task 1: Kostra + design systém

**Files:**
- Create: `index.html`
- Create: `styles.css`

**Interfaces:**
- Produces: HTML kostra se všemi sekcemi (`#hero`, `#vyhody`, `#postup`, `#reference`, `#poptavka`, footer) a CSS proměnné v `:root` (`--bg`, `--surface`, `--text`, `--muted`, `--accent`, `--accent-hover`, `--light-bg`, `--light-text`), které používají všechny další tasky.

- [ ] **Step 1: Vytvořit `index.html`** — kompletní sémantická kostra: `<head>` s meta (charset, viewport, description, title „Helion — Solární elektrárny na klíč"), Google Fonts link (Space Grotesk 600,700 + Inter 400,500,600), prázdné sekce s id a nadpisy, `<script src="script.js" defer>`.

- [ ] **Step 2: Vytvořit `styles.css`** — `:root` tokeny dle Design direction, reset (`box-sizing`, margin 0), base typografie, `.container` (max-width 72rem, padding-inline `clamp(1.25rem, 5vw, 2.5rem)`), utility `.btn` (accent pozadí, tmavý text, padding `0.875rem 1.75rem`, radius 8px, hover přechod) a `.btn--ghost`.

- [ ] **Step 3: Ověřit v prohlížeči** — otevřít přes preview, zkontrolovat: fonty se načetly, tokeny fungují, žádné chyby v konzoli.

- [ ] **Step 4: Commit** — `git add index.html styles.css && git commit -m "feat: skeleton and design tokens for Helion landing"`

### Task 2: Hlavička + hero

**Files:**
- Modify: `index.html` (header + hero sekce)
- Modify: `styles.css`

**Interfaces:**
- Consumes: tokeny a `.btn` z Task 1
- Produces: `.site-header` s `.nav-toggle` (hamburger, `aria-expanded`) a `.site-nav` — Task 5 na ně věší JS

- [ ] **Step 1: Header** — logo „Helion◦" (tečka v akcentu), nav kotvy (Výhody, Jak to probíhá, Reference, Kontakt), CTA „Nezávazná poptávka" → `#poptavka`. Sticky, pozadí `--bg` s 90% opacitou + blur. Na mobilu hamburger tlačítko (3 spany), nav skrytá, otevírá se třídou `.is-open` (fullscreen overlay).

- [ ] **Step 2: Hero** — tmavé pozadí s velkým radiálním gradientem (oranžová záře od horizontu — „slunce"), eyebrow text „SOLÁRNÍ ELEKTRÁRNY NA KLÍČ", h1 „Vyrábějte si vlastní elektřinu ze slunce.", podnadpis o úspoře a nezávislosti, dvě CTA (primární → `#poptavka`, ghost „Jak to probíhá →" → `#postup`). Pod tím řádek důvěryhodnosti: „500+ instalací · 12 let na trhu · záruka 25 let na panely".

- [ ] **Step 3: Ověřit** — desktop i 375 px šířka (menu zatím nefunkční bez JS — jen vzhled), hero čitelné, gradient decentní.

- [ ] **Step 4: Commit** — `git commit -m "feat: header and hero section"`

### Task 3: Obsahové sekce (výhody, postup, reference)

**Files:**
- Modify: `index.html`
- Modify: `styles.css`

**Interfaces:**
- Consumes: tokeny, `.container`; sekce id z Task 1

- [ ] **Step 1: Výhody** (`#vyhody`, světlé pozadí `--light-bg`) — 4 karty v gridu (`repeat(auto-fit, minmax(240px, 1fr))`): Nižší účty za elektřinu (úspora až 70 %), Energetická nezávislost, Dotace NZÚ (vyřídíme za vás), Návratnost 6–8 let. Každá karta: inline SVG ikona (linka, akcent barva), h3, 2 věty. Bez stínů, jemný border.

- [ ] **Step 2: Postup** (`#postup`, tmavé pozadí) — 4 kroky vertikálně/horizontálně s velkými čísly `01–04` v akcentu: Konzultace zdarma → Návrh na míru → Instalace za 2 dny → Servis a monitoring. Číslo velkým Space Grotesk, popis vedle.

- [ ] **Step 3: Reference** (`#reference`, světlé) — řádek statistik (500+ instalací, 4,2 MWp výkon, 98 % doporučuje) velkou typografií + 2 krátké citace zákazníků (jméno, město) jako prosté blockquoty.

- [ ] **Step 4: Ověřit** — kontrast tmavá/světlá střídání funguje, grid se láme správně na 360/768/1200 px.

- [ ] **Step 5: Commit** — `git commit -m "feat: benefits, process and references sections"`

### Task 4: Formulář + patička

**Files:**
- Modify: `index.html`
- Modify: `styles.css`

**Interfaces:**
- Produces: `<form id="lead-form" novalidate>` s poli `name`, `email`, `phone`, `message` (message nepovinná), `.form-error` spany u polí, skrytý `.form-success` blok — Task 5 implementuje validaci

- [ ] **Step 1: Formulář** (`#poptavka`, tmavé, vizuálně nejvýraznější sekce) — h2 „Nezávazná poptávka", text „Ozveme se do 24 hodin.", pole: Jméno a příjmení, E-mail, Telefon, Zpráva (textarea, nepovinné). Každé pole obalené v `<div class="form-field">`: label, input, prázdný `<span class="form-error">` (JS v Task 5 hledá chybu přes `input.closest('.form-field')`). Submit `.btn`. Skrytý `<div class="form-success" hidden>` s potvrzením „Děkujeme! Ozveme se vám do 24 hodin."

- [ ] **Step 2: Patička** — 3 sloupce: Helion + slogan, kontakt (info@helion.cz, +420 777 123 456, Praha), IČO 12345678 + © 2026 Helion s.r.o. Jemný horní border.

- [ ] **Step 3: Ověřit + commit** — `git commit -m "feat: lead form and footer"`

### Task 5: JavaScript (menu, scroll, validace)

**Files:**
- Create: `script.js`

**Interfaces:**
- Consumes: `.nav-toggle`, `.site-nav`, `.is-open` (Task 2); `#lead-form`, `.form-error`, `.form-success` (Task 4)

- [ ] **Step 1: Napsat `script.js`**

```js
// Hamburger menu
const toggle = document.querySelector('.nav-toggle');
const nav = document.querySelector('.site-nav');
toggle.addEventListener('click', () => {
  const open = nav.classList.toggle('is-open');
  toggle.setAttribute('aria-expanded', open);
});
// Zavřít menu po kliku na kotvu
nav.addEventListener('click', (e) => {
  if (e.target.matches('a')) {
    nav.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
  }
});

// Validace formuláře
const form = document.getElementById('lead-form');
const fields = {
  name:  { test: (v) => v.trim().length >= 3, msg: 'Vyplňte prosím jméno a příjmení.' },
  email: { test: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), msg: 'Zadejte platný e-mail.' },
  phone: { test: (v) => /^[+\d][\d\s]{8,}$/.test(v.trim()), msg: 'Zadejte platné telefonní číslo.' },
};
form.addEventListener('submit', (e) => {
  e.preventDefault();
  let valid = true;
  for (const [id, { test, msg }] of Object.entries(fields)) {
    const input = form.elements[id];
    const error = input.closest('.form-field').querySelector('.form-error');
    const ok = test(input.value);
    error.textContent = ok ? '' : msg;
    input.classList.toggle('is-invalid', !ok);
    if (!ok) valid = false;
  }
  if (valid) {
    form.hidden = true;
    document.querySelector('.form-success').hidden = false;
  }
});
```

(Plynulý scroll řeší CSS `scroll-behavior: smooth` + `scroll-margin-top` na sekcích — bez JS.)

- [ ] **Step 2: Ověřit chování** — mobil: hamburger otevře/zavře menu, klik na kotvu zavře. Formulář: prázdné odeslání ukáže 3 chyby; špatný e-mail ukáže chybu; validní data schovají formulář a ukážou potvrzení.

- [ ] **Step 3: Commit** — `git commit -m "feat: menu toggle and form validation"`

### Task 6: Responzivní kontrola + finální polish

**Files:**
- Modify: `styles.css` (drobné korekce)

- [ ] **Step 1: Projít 360 / 768 / 1024 / 1440 px** přes preview resize — žádný horizontální scroll, typografie škáluje, karty se lámou správně.
- [ ] **Step 2: Taste-skill pre-flight check** — projít stránku proti anti-slop pravidlům (žádné generic AI patterny, hierarchie, kontrast, konzistentní palety).
- [ ] **Step 3: Konzole bez chyb, kotvy fungují, `file://` otevření funguje.**
- [ ] **Step 4: Commit** — `git commit -m "polish: responsive fixes"`
