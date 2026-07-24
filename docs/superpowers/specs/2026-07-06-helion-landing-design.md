# Helion — landing page pro instalace solárních panelů

Datum: 2026-07-06
Stav: schváleno uživatelem

## Cíl

Firemní landing page pro firmu Helion (instalace solárních panelů na střechy).
Cílem je prezentovat služby a získat poptávky přes kontaktní formulář.

## Technologie

Statické HTML + CSS + JS, bez buildu a bez závislostí:

- `index.html` — veškerý obsah, sémantické HTML, texty česky
- `styles.css` — mobile-first responzivní styly, CSS proměnné, grid/flex
- `script.js` — hamburger menu, plynulý scroll na kotvy, validace formuláře

## Vizuální styl

- Akcent: sluneční oranžová/žlutá
- Základ: tmavě modrá / antracit, bílé plochy
- Velká typografie, hodně vzduchu
- Obrázky jako placeholdery (snadno vyměnitelné)

## Struktura stránky

1. **Hlavička** — logo „Helion", kotvy na sekce, CTA „Nezávazná poptávka"; na mobilu hamburger
2. **Hero** — headline „Vyrábějte si vlastní elektřinu ze slunce", podnadpis, hlavní CTA + odkaz „Jak to funguje"
3. **Výhody** — 3–4 karty: úspora na účtech, energetická nezávislost, ekologie, dotace/návratnost
4. **Jak to probíhá** — kroky: konzultace → návrh na míru → instalace → servis
5. **Čísla/reference** — statistiky (instalace, kWp, zákazníci) + krátké reference
6. **Poptávkový formulář** — jméno, e-mail, telefon, zpráva; JS validace; odeslání pouze frontend (potvrzení), backend později
7. **Patička** — kontakt, IČO placeholder, sociální sítě, copyright

## Mimo rozsah (záměrně)

- Backend odesílání formuláře
- CMS, více jazyků, cookie lišta, kalkulačka úspor

## Kritéria hotovosti

- Web funguje otevřením `index.html` v prohlížeči, bez build kroku
- Responzivní od 360 px do desktopu
- Formulář validuje vstupy a zobrazí potvrzení
- Žádné externí JS závislosti
