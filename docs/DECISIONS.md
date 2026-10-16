# Ontwerpkeuzes

Keuzes die niet in `SPEC.md` geregeld zijn. Nieuwste onderaan. Per keuze: datum, keuze en reden.

## Fase 0 — Fundament

### 2026-10-16 · Eigen git-repository

**Keuze:** eigen repository in `C:\dev\bnwv_lmc_app`, standaardbranch `main`.
**Reden:** er bestond al een lege repo op `C:\`. De projectmap moet een zelfstandige, publieke repo zijn.

### 2026-10-16 · Eén package in de root

**Keuze:** geen monorepo. De frontend staat in `src/`. De backend staat in `supabase/`: migraties, pgTAP-tests en Edge Functions met een eigen `deno.json`.
**Reden:** dat vraagt de minste tooling. Edge Functions draaien op Deno en hebben geen npm-package nodig.

### 2026-10-16 · npm en Node 24 LTS

**Keuze:** npm met `package-lock.json`. Node 24 LTS (`.nvmrc`), de actuele LTS-lijn in oktober 2026. Versies van dependencies staan exact vast.
**Reden:** npm wordt met Node meegeleverd, dus er is geen extra tool nodig. Exacte versies maken updates bewuste stappen via Dependabot.

### 2026-10-16 · TypeScript 6.0 in plaats van 7

**Keuze:** `typescript@6.0.x`.
**Reden:** `typescript-eslint` ondersteunt TypeScript 7 (de native compiler) nog niet; de peer-range is `<6.1`. Overstappen kan zodra die ondersteuning er is.

### 2026-10-16 · `react-router` v8 in plaats van `react-router-dom`

**Keuze:** het package `react-router` (v8), met `HashRouter`.
**Reden:** vanaf v7 is `react-router-dom` alleen een doorverwijzing naar `react-router`. Zo is er één dependency minder.

### 2026-10-16 · CSP via een Vite-plugin, alleen in de build

**Keuze:** `csp.ts` bouwt de policy en een Vite-plugin plaatst de meta-tag vooraan in `<head>`. De Supabase-origin komt uit `VITE_SUPABASE_URL`.

- De build faalt als die variabele ontbreekt of meer is dan een kale origin.
- De dev-server krijgt geen CSP. Met `npm run preview` is de build mét CSP te testen.
- Policy: `default-src 'self'`, `script-src 'self'`, `style-src 'self'`, `connect-src <supabase-origin>`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-src 'none'`.

**Reden:** `connect-src` moet de exacte Supabase-URL bevatten, en die verschilt per omgeving. De dev-server van Vite gebruikt inline scripts voor hot reload, die de CSP terecht blokkeert. De meta-tag staat vooraan omdat een CSP alleen werkt voor wat erna komt.

### 2026-10-16 · Pages-pad

**Keuze:** de Vite-`base` is `/bnwv_lmc_app/` voor productiebuilds.
**Reden:** GitHub Pages serveert de site onder de reponaam.

### 2026-10-16 · Geen uitzonderingen op `.env*`

**Keuze:** geen `.env.example`. De benodigde omgevingsvariabelen staan in `docs/SETUP.md`.
**Reden:** de spec zegt `.env*` negeren. Zo kan er ook nooit per ongeluk een gevuld voorbeeldbestand in de repo komen.

### 2026-10-16 · Fixture byte-exact

**Keuze:** `.gitattributes` markeert `*.xml` als `-text`. Prettier slaat `fixtures/` over.
**Reden:** de MATT-fixture moet byte-exact blijven: UTF-8 met BOM, één regel, geen conversie van regeleinden.

### 2026-10-16 · GitHub Actions vastgepind

**Keuze:** actions zijn vastgepind op een commit-SHA, met de versie als commentaar. Workflows krijgen minimale `permissions` en `persist-credentials: false`. Dependabot houdt npm en Actions wekelijks bij. De Supabase CLI in CI staat vast op 2.115.0, gelijk aan lokaal.
**Reden:** bescherming tegen supply-chain-aanvallen via verplaatste tags, en reproduceerbare builds.

### 2026-10-16 · Deploy pas na CI, en voorlopig uit

**Keuze:** `deploy-pages.yml` start via `workflow_run` alleen na een geslaagde CI-run op een push naar `main`. Er is geen handmatige trigger. De workflow doet niets zolang de repository-variabele `PAGES_DEPLOY_ENABLED` niet `true` is.
**Reden:** de spec vraagt "eerst alle tests, daarna pas deploy, alleen vanaf `main`" en een deploy die nog niet actief is. In fase 6 gaat hij aan zonder dat de workflow hoeft te veranderen.

### 2026-10-16 · Auth lokaal (`supabase/config.toml`)

**Keuze:**

- registratie uit;
- e-mailbevestiging aan;
- `secure_password_change` aan;
- minimaal 12 tekens zonder samenstellingseisen;
- TOTP inschrijven en verifiëren aan;
- maximaal 4 MFA-factoren per gebruiker;
- `site_url` is de Vite-dev-server (`127.0.0.1:5173`).

**Reden:** volgt SPEC §7. Vier factoren is genoeg voor een tweede toestel plus marge en beperkt misbruik.

### 2026-10-16 · Fundamenttest controleert RLS op alle tabellen

**Keuze:** `supabase/tests/database/000_fundament.test.sql` faalt zodra er een tabel in `public` staat zonder RLS.
**Reden:** dit vangsnet voor de regel "RLS op élke tabel" geldt automatisch voor elke nieuwe migratie.

### 2026-10-16 · Naam-normalisatie als gedeelde Edge Function-module

**Keuze:** `supabase/functions/_gedeeld/normaliseer.ts` implementeert de normalisatie van aliassen uit SPEC §4.
**Reden:** de MATT-import (fase 5) heeft die nodig, en het geeft de Deno-pijplijn in fase 0 een echte test.

### 2026-10-16 · Schooljaren in de seed

**Keuze:** de seed in fase 1 krijgt schooljaar 2025-2026 én 2026-2027.
**Reden:** de synthetische fixture bevat boekingen van januari tot en met maart 2026, dus in schooljaar 2025-2026.

### 2026-10-16 · Voorstel: weekendboekingen accepteren (te bevestigen in fase 5)

**Keuze:** boekingen op zaterdag of zondag worden bij de import geaccepteerd en tellen mee als gerealiseerd.
**Reden:** de fixture bevat weekendboekingen, bijvoorbeeld op 18-1-2026. Capaciteit wordt per werkdag berekend, maar realisatie is wat er feitelijk geboekt is.

## Bewaartermijn (ontwerp, nog niet geautomatiseerd)

Dit wordt in fase 1 uitgewerkt volgens SPEC §10. Detailboekingen en omschrijvingen blijven het lopende en de twee voorgaande schooljaren bewaard. Daarna blijven alleen totalen per medewerker per schooljaar over. De uitvoering volgt in versie 2 via `pg_cron`.
