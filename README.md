# Asistel — web

Statický web postavený na [Astro](https://astro.build) s vizuálním editorem [Decap CMS](https://decapcms.org) (stejný systém jako web Ďyvadla Neklid).

## Úprava obsahu (pro kolegy)

1. Otevřete `https://<adresa-webu>/admin` a přihlaste se e-mailem (Netlify Identity).
2. Upravte texty, prodejny, tým nebo fotoalbum — fotky se nahrávají přímo v editoru.
3. Po uložení se změna commitne do repozitáře a web se sám přegeneruje.

Obsah je uložen v `src/data/editable/*.json`, nahrané fotky v `public/uploads/`.

## Vývoj

```bash
npm install
npm run dev      # dev server na http://localhost:4321
npm run build    # produkční build do dist/
```

Lokální zkoušení editoru bez přihlašování: v `public/admin/config.yml` odkomentujte
`local_backend: true` a spusťte `npx decap-server` vedle `npm run dev`.

## Nasazení

Netlify (viz `netlify.toml`): build `npm run build`, publish `dist`. Pro editor
zapněte na Netlify **Identity** + **Git Gateway** a pozvěte editory e-mailem.
