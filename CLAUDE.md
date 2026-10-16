# CLAUDE.md — vaste werkregels

Volledige specificatie: `docs/SPEC.md`. Ontwerpkeuzes: `docs/DECISIONS.md`. Handmatige stappen: `docs/SETUP.md`.

## Werkwijze

- Werk in fasen (SPEC §12). Stop na elke fase en wacht op akkoord.
- Bij twijfel: vragen, niet aannemen.
- Elke ontwerpkeuze die niet in de SPEC staat → `docs/DECISIONS.md` (datum, keuze, reden).
- Tests horen bij "klaar": een fase is af als de tests bestaan en slagen.

## Beveiliging en privacy (gaat boven alles)

- **Repo is publiek.** Nooit committen: `service_role`-sleutel, wachtwoorden, tokens, `.env*`, echte namen van medewerkers, echte MATT-exports.
- **Alleen synthetische testdata** (`fixtures/`). Werk alleen lokaal (`supabase start`) of tegen het testproject, nooit tegen productie.
- Het enige Supabase-project is **BNWV - LMC APP** (`hgpgrqkurnulenqcighy`): tot het betaalde plan, de verwerkersovereenkomst en het akkoord van FG en OR **alleen fictieve gegevens** (zie DECISIONS.md, Omgeving). Andere projecten in de organisatie niet aanraken.
- **`service_role` alleen in Edge Functions**, als secret.
- **RLS aan op élke tabel**, "niets mag, tenzij". Nieuwe tabel ⇒ in dezelfde migratie RLS-policies én pgTAP-tests.
- **Autorisatie in de database**, niet in de frontend. Rollen in een eigen tabel, nooit `user_metadata`.
- Alle datatoegang vereist `aal2`. Zonder rol of zonder gekoppelde medewerker: niets.
- `SECURITY DEFINER` ⇒ altijd `SET search_path = ''` en volledig gekwalificeerde namen. Views ⇒ `WITH (security_invoker = true)`.
- **Dataminimalisatie**: afwezigheid nooit met een reden (geen ziekte, geen verlofsoort).
- **Doelbinding**: capaciteitsplanning en werkverdeling, geen beoordeling. Geen woorden/kleuren als "achterstand" of "te weinig". Vaste tekst zichtbaar in de app:
  > Dit overzicht is bedoeld voor capaciteitsplanning en een eerlijke werkverdeling. Het is geen middel om prestaties te beoordelen.
- Auditlog is append-only (geen update/delete-policies, ook niet voor beheerders).

## Techniek

- Frontend: Vite + React + TypeScript strict, `HashRouter`, TanStack Query, zod.
- Backend: Supabase (Postgres, Auth, Edge Functions in Deno/TypeScript), EU-regio. Types via `supabase gen types`.
- Tests: pgTAP (`supabase test db`), Vitest (frontend), `deno test` (Edge Functions).
- CI: lint, typecheck, alle tests, daarna pas deploy; deploy alleen vanaf `main`.
- Minimaal aantal dependencies; lockfile committen.
- CSP via `<meta http-equiv>`: `default-src 'self'`, `connect-src` alleen eigen Supabase-URL, geen `unsafe-inline` scripts, geen `eval`.
- Geen gevoelige gegevens in URL's/querystrings. `localStorage` alleen voor de Supabase-sessie.
- Taal: UI, commentaar, tabel- en kolomnamen in het Nederlands; snake_case zonder diakrieten.
- Rekenen in `numeric`, pas afronden in de weergave (1 decimaal).
- Elke `UPDATE`/`DELETE` heeft een `WHERE` (Supabase laadt `safeupdate` voor API-aanvragen).

## Commando's

```bash
npm run lint        # ESLint + Prettier-check
npm run typecheck   # tsc --noEmit
npm test            # Vitest
supabase start      # lokale stack (vereist Docker)
supabase test db    # pgTAP
deno task check     # lint + typecheck + test Edge Functions (vanuit supabase/functions)
```
