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

## Fase 1 — Database en RLS

### 2026-10-16 · Iedere gebruiker is een medewerker

**Keuze:** ook manager en beheerder hebben een `medewerker`-record. Zonder gekoppelde, actieve medewerker is er geen toegang. Wie geen contract heeft in een schooljaar, verschijnt in dat jaar niet in het teamoverzicht (fase 6).
**Reden:** SPEC §6 ("zonder gekoppelde medewerker ziet niets"); bevestigd door de eigenaar.

### 2026-10-16 · Koppeling met de inlog alleen in `profiel`

**Keuze:** `medewerker` krijgt geen kolom naar `auth.users`. De koppeling staat alleen in `profiel` (gebruiker 1-op-1 met medewerker, beide uniek).
**Reden:** zo wordt dezelfde koppeling niet op twee plekken vastgelegd.

### 2026-10-16 · Toegangsvoorwaarden in één functie

**Keuze:** `private.heeft_toegang()` vereist al het volgende:

- `aal2`;
- een profiel met een actieve medewerker;
- minstens één rol;
- `moet_wachtwoord_wijzigen = false`.

Alle policies bouwen hierop voort, via `heeft_rol()`, `heeft_een_rol()` en `eigen_medewerker_id()`.
**Reden:** deactiveren of een rol afnemen trekt de toegang zo direct in, en "eerst wachtwoord wijzigen" wordt ook in de database afgedwongen. De frontend krijgt in fase 2 een aparte RPC om de eigen status op te vragen vóór er toegang is.

### 2026-10-16 · Schema `private` en `private.beveilig_tabel()`

**Keuze:** hulpfuncties staan in het schema `private`, dat niet via de Data API bereikbaar is. Elke tabel wordt ingericht met `private.beveilig_tabel()`:

- RLS aan;
- alle rechten van `anon` en `public` ingetrokken;
- `select` (en eventueel insert, update en delete) voor `authenticated`;
- de policies `lezen`, `toevoegen`, `wijzigen` en `verwijderen`;
- de audit-trigger.

**Reden:** één vast patroon voorkomt vergeten policies of rechten. De fundamenttest controleert het patroon bovendien voor álle tabellen.

### 2026-10-16 · uuid als primaire sleutel

**Keuze:** overal `uuid` (`gen_random_uuid()`), behalve `auditlog` (`bigint identity`, voor de volgorde).
**Reden:** er lekken geen aantallen en ID's zijn niet te raden. RLS blijft de echte verdediging.

### 2026-10-16 · Rollen toekennen zonder escalatie

**Keuze:** niemand wijzigt de eigen rollen of het eigen profiel. Alleen een beheerder kent de rol `beheerder` toe of neemt hem af. Manager en beheerder kunnen `moet_wachtwoord_wijzigen` niet wijzigen (kolomrechten); dat doen alleen Edge Functions en triggers.
**Reden:** anders kan een manager zichzelf beheerder maken en zo omschrijvingen van anderen lezen; bevestigd door de eigenaar.
**Restrisico:** wie accounts aanmaakt (manager, beheerder), ziet het tijdelijke wachtwoord. In theorie kan die een account aan een andere medewerker koppelen en daarmee inloggen. Dit staat in het auditlog (profiel en gebruiker_rol) en is organisatorisch te beheersen.

### 2026-10-16 · Leesrechten op referentiegegevens

**Keuze:**

- schooljaren, vakanties, feestdagen, staffel, opslagfactoren, instellingen, artikelmapping, werkpakketten, scholen, activiteittypes en MATT-projecten zijn leesbaar voor iedereen met toegang;
- `medewerker_alias` is alleen leesbaar voor coordinator, manager en beheerder.

**Reden:** de lmc heeft deze gegevens nodig om de eigen belasting te zien. Het zijn geen persoonsgegevens; schooladressen zijn zakelijk. Aliassen dienen alleen de import.

### 2026-10-16 · MATT-projecten beheren ook door de beheerder

**Keuze:** `matt_project` (koppelen en negeren) is te beheren door coordinator, manager en beheerder.
**Reden:** de lijst "niet-gekoppelde MATT-projecten" hoort bij het importproces, en dat mogen deze drie rollen uitvoeren (SPEC §6).

### 2026-10-16 · Boekingen alleen via RPC's

**Keuze:** `matt_import`, `boeking` en `boeking_omschrijving` hebben geen insert-, update- of delete-policies. De import (fase 5) schrijft via `SECURITY DEFINER`-functies die de rol controleren, en draait onder de JWT van de gebruiker, zodat het auditlog weet wie het deed.
**Reden:** concept, definitief maken en terugdraaien moeten transactioneel en volledig gecontroleerd verlopen.

### 2026-10-16 · Omschrijvingen van anderen alleen via `boeking_details_van_ander()`

**Keuze:** rechtstreeks leest iedere rol alleen de eigen omschrijvingen, ook coordinator en beheerder. Omschrijvingen van anderen lopen via de RPC `boeking_details_van_ander(medewerker, van, tot)`. Die:

- is alleen voor coordinator en beheerder;
- laat teruggedraaide imports weg;
- schrijft elke opvraging in het auditlog, met aantal en periode maar zonder de omschrijvingen zelf.

De manager ziet boekingen van anderen wel, maar zonder omschrijving.
**Reden:** SPEC §6 ("loopt via een RPC-functie die het opvragen in het auditlog schrijft").

### 2026-10-16 · Audit per import, niet per boeking

**Keuze:** `boeking` en `boeking_omschrijving` hebben geen rij-audit. `matt_import` wel, en de RPC's in fase 5 loggen definitief maken en terugdraaien met aantallen.
**Reden:** de manager mag het auditlog lezen, maar geen omschrijvingen van anderen. Een import van duizenden regels zou het log bovendien laten ontploffen. Bevestigd door de eigenaar.

### 2026-10-16 · Auditlog drievoudig append-only

**Keuze:**

- er zijn geen update- of delete-policies;
- `REVOKE` van insert, update, delete en truncate, ook voor `service_role`;
- triggers weigeren update, delete en truncate, zelfs voor de eigenaar.

Schrijven gebeurt alleen via `private.log_actie()`.
**Reden:** SPEC §4 ("ook niet voor beheerders").

### 2026-10-16 · Staffeluren verdelen met `aandeel_percentage`

**Keuze:** `toewijzing.aandeel_percentage` (standaard 100, alleen bij bron `staffel`) geeft het deel van de staffeluren voor een medewerker, als meerdere LMC'ers op één school werken. De database dwingt niet af dat de som 100 is; de app toont een signaal.
**Reden:** bevestigd door de eigenaar. Een harde controle zou het tijdelijk invoeren van toewijzingen onmogelijk maken.

### 2026-10-16 · Afgeleide uren niet opslaan

**Keuze:** bij bron `staffel` en `norm_x_aantal` blijven `gepland_*` leeg; de uren worden in fase 3 berekend. Bij `handmatig` zijn alle drie verplicht.
**Reden:** de rekenregels staan op één plek (SPEC §5), en een wijziging in staffel of normuren werkt meteen door.

### 2026-10-16 · Extra constraints

**Keuze:**

- **activiteit:** een werkpakket met soort `activiteit` heeft een `activiteittype_id`, andere soorten niet;
- **school:** heeft een samengestelde foreign key (`werkpakket_id`, `soort`), zodat het werkpakket echt een school is;
- **toewijzing:**
  - één per (medewerker, werkpakket, schooljaar);
  - een trigger controleert dat bron en soort bij elkaar passen en dat de looptijd binnen het schooljaar valt;
- **datums bij `op_datum`:** staan in `toewijzing_datum` en liggen binnen het schooljaar;
- **exclusion constraints:** geen overlap bij schooljaren, staffelbereiken, contracten (spec) en `niet_beschikbaar`;
- **schoolvakanties:** liggen binnen hun schooljaar. Een zomervakantie over de jaargrens wordt in twee delen vastgelegd;
- **instellingen:** alleen bekende sleutels, met een gecontroleerd formaat van de waarde;
- **verwijderen:** een medewerker met toewijzingen of boekingen kan niet worden verwijderd (`RESTRICT`) en wordt gedeactiveerd.

**Reden:** validatie aan de serverzijde (SPEC §9). Overlap bij `niet_beschikbaar` maakt het percentage op een dag dubbelzinnig.

### 2026-10-16 · Seed

**Keuze:**

- **schooljaren en vakanties:** 2025-2026 en 2026-2027, met indicatieve schoolvakanties (nog te controleren);
- **feestdagen:** voor 2026-2027 exact de testfeestdagen uit SPEC §5;
- **rekenparameters:** een fictieve staffel en het domein `voorbeeld.test`;
- **medewerkers:** de vijf namen uit de fixture, met MATT-aliassen;
- **projecten:** 13 gekoppelde MATT-projecten;
- **toewijzingen:** van elke bron één of meer.

"Testpersoon Onbekend" en project 999 staan er bewust niet in. Er zijn geen auth-gebruikers of wachtwoorden.
**Reden:** de import-tests (fase 5) hebben een niet-gematchte medewerker en een onbekend project nodig. Wachtwoorden horen niet in de repo.

### 2026-10-16 · Teststrategie pgTAP

**Keuze:**

- **hulpfuncties:** `00000_helpers.test.sql` maakt het schema `tests` aan en wordt niet teruggedraaid, zodat de volgende testbestanden het kunnen gebruiken;
- **rechtenmatrix:** `tests.matrix()` controleert per tabel lezen, toevoegen, wijzigen en verwijderen voor 12 persona's: lmc A en B, coordinator, manager, beheerder, lmc en manager op `aal1`, zonder rol, zonder medewerker, gedeactiveerd, moet wachtwoord wijzigen, en anon;
- **expliciete tests:** daarnaast tests voor de eisen uit §6 en voor alle constraints.

**Reden:** de tests geven §6 systematisch weer. Een nieuwe tabel krijgt met één aanroep een volledige matrix.

### 2026-10-16 · Snelle lokale testopstelling zonder Docker

**Keuze:** zolang Docker ontbreekt, test de ontwikkelaar lokaal met PGlite (Postgres in WASM), met nagebootste Supabase-rollen en `auth`-functies en een kleine pgTAP-vervanger. Dit staat buiten de repository. Het echte bewijs is `supabase test db` in CI.
**Reden:** CI duurt minuten per poging. Mutatietests (bewust verzwakte policies) bevestigen dat de tests echt falen bij fouten.

## Bewaartermijn (ontwerp, nog niet geautomatiseerd)

Volgens SPEC §10. De uitvoering volgt in versie 2 via `pg_cron`.

- **Termijn:** detailboekingen (`boeking`) en omschrijvingen (`boeking_omschrijving`) blijven bewaard voor het lopende schooljaar en de twee voorgaande schooljaren.
- **Daarna:** er blijven alleen totalen over per medewerker per schooljaar per categorie en per werkpakket (of "niet gekoppeld"). Ze komen in een nieuwe tabel `realisatie_totaal (medewerker_id, schooljaar_id, werkpakket_id null, categorie, uren)`, met dezelfde RLS als `boeking`.
- **Jaarlijkse job**, bijvoorbeeld op 1 september, als één `SECURITY DEFINER`-functie in één transactie:
  1. totalen berekenen voor de schooljaren die buiten de termijn vallen (alleen definitieve imports);
  2. die totalen opslaan in `realisatie_totaal`;
  3. de detailboekingen verwijderen (omschrijvingen gaan via cascade mee);
  4. het aantal verwijderde rijen per schooljaar in het auditlog schrijven.
- **Verwijderen:** teruggedraaide en concept-imports ouder dan de termijn worden volledig verwijderd.
- **Auditlog:** krijgt een eigen bewaartermijn, nog vast te stellen met de FG. Dat vraagt een gecontroleerde uitzondering op de append-only-trigger, uitsluitend voor deze job.

## Fase 2 — Authenticatie

### 2026-10-17 · Inlogstroom via `mijn_status()`

**Keuze:** de frontend bepaalt de stap met de pure functie `bepaalStap()`. Die gebruikt de sessie, het `aal`-niveau, de geverifieerde TOTP-factoren en `public.mijn_status()`. Die functie werkt al op `aal1`, maar geeft alleen eigen vlaggen terug en geen gegevens. Met een gekoppeld toestel komt eerst de TOTP-code en pas daarna een eventuele wachtwoordwijziging.
**Reden:** Supabase staat een wachtwoordwijziging bij een gekoppeld toestel alleen op `aal2` toe. De frontend verbergt alleen; RLS blijft beslissen.

### 2026-10-17 · Wachtwoordvlag via een trigger op `auth.users`

**Keuze:** de trigger `bnwv_wachtwoord_gewijzigd` zet `moet_wachtwoord_wijzigen` op false zodra `encrypted_password` werkelijk verandert. `account-resetten` zet de vlag na het tijdelijke wachtwoord direct weer op true (met `service_role`).
**Reden:** bevestigd door de eigenaar. Er is geen extra Edge Function nodig, en een gebruiker kan de vlag niet uitzetten zonder het wachtwoord echt te wijzigen.
**Restrisico:** mislukt de laatste stap van een reset, dan meldt de functie 500. Het account blijft dan zonder toegang, want de vlag stond al op true en de sessies zijn al beëindigd.

### 2026-10-17 · Rechtencontrole in de database, ook voor Edge Functions

**Keuze:** beide functies roepen eerst `mag_gebruikers_beheren()` aan met de JWT van de aanroeper.

- `gebruiker-aanmaken` legt `profiel` en `gebruiker_rol` vast met die JWT. Zo dwingt RLS de rolregels uit fase 1 af, en registreert de audit-trigger wie het deed.
- `account-resetten` gebruikt de RPC `account_reset_voorbereiden()`, die ook het eigen account weigert.

Pas daarna gebruiken de functies de admin-API (`service_role`), alleen voor wat alleen die kan: een account aanmaken of verwijderen, factoren verwijderen en een wachtwoord zetten.
**Reden:** SPEC §1 ("de database beslist"). Bovendien noemt het auditlog zo de echte uitvoerder in plaats van `service_role`.

### 2026-10-17 · Een beheerder resetten alleen door een beheerder

**Keuze:** `account_reset_voorbereiden()` weigert een manager die een beheerder wil resetten.
**Reden:** dezelfde regel als bij rollen toekennen. Anders kan een manager een beheerdersaccount overnemen: resetten, het tijdelijke wachtwoord gebruiken en zo omschrijvingen lezen.

### 2026-10-17 · Sessies beëindigen bij reset en deactiveren

**Keuze:** `private.beeindig_sessies()` verwijdert `auth.sessions` en `auth.refresh_tokens` van de gebruiker. Dat gebeurt bij een reset en via een trigger zodra `medewerker.actief` op false gaat.
**Reden:** SPEC §7 ("trekt de toegang direct in"). Een nog geldig access token geeft daarna ook niets meer, omdat `heeft_toegang()` de vlag, de rol en de actieve medewerker controleert.

### 2026-10-17 · Account-e-mail = medewerker-e-mail

**Keuze:** `gebruiker-aanmaken` vraagt alleen `medewerker_id` en rollen. Het e-mailadres komt van de medewerker en moet binnen `toegestaan_email_domein` vallen; subdomeinen tellen niet mee.
**Reden:** bevestigd door de eigenaar. Zo is er minder invoer en minder kans op fouten.

### 2026-10-17 · Tijdelijk wachtwoord

**Keuze:** 20 tekens uit een alfabet van 57 zonder verwarrende tekens (geen 0/O, 1/l/I), gemaakt met `crypto.getRandomValues` en rejection sampling. Dat is ongeveer 116 bits. Het wachtwoord staat alleen in het antwoord (`Cache-Control: no-store`) en wordt nergens opgeslagen.
**Reden:** SPEC §7 ("sterk tijdelijk wachtwoord, één keer teruggeven").

### 2026-10-17 · Uitloggen na 30 minuten inactiviteit

**Keuze:** de frontend logt uit na 30 minuten zonder muis-, toets- of aanraakactiviteit.
**Reden:** bevestigd door de eigenaar. De time-out in het Supabase-dashboard vraagt een betaald plan (zie SETUP.md); dit is een gratis aanvulling.

### 2026-10-17 · Klaar voor OAuth zonder datamodelwijziging

**Keuze:** de Supabase-client gebruikt `flowType: 'pkce'` en `detectSessionInUrl: false`. De koppeling met een medewerker staat in `profiel` en is niet gebonden aan een inlogmethode.
**Reden:** SPEC §7. Een latere Entra ID-login kan een bestaand `auth.users`-record koppelen. Tot die tijd komen er nooit tokens in een URL.

### 2026-10-17 · CI op elke push; end-to-end-test met de volledige stack

**Keuze:**

- **Trigger:** CI draait bij een push op elke branch, in plaats van bij pull requests.
- **Nieuwe job `e2e`:**
  1. start `supabase start`, zonder studio, storage, realtime en logging;
  2. controleert of `src/lib/database.types.ts` gelijk is aan `supabase gen types`;
  3. draait `e2e/inlogstroom.test.ts` (Deno), die de hele stroom doorloopt met zelf berekende TOTP-codes:
     - inloggen op `aal1` geeft geen toegang;
     - wachtwoord wijzigen;
     - TOTP koppelen, ook een tweede toestel;
     - account aanmaken;
     - een rol of domein dat niet mag wordt geweigerd;
     - een eigen reset wordt geweigerd;
     - een reset door de manager;
     - deactiveren.
- **Verouderde types:** zet de job het gegenereerde bestand gecomprimeerd in annotaties. Die zijn ook zonder inloggen te lezen.

**Reden:** de eigenaar wilde het sterkste bewijs. Status checks gelden per commit, dus ook voor een PR met die commit. Lokaal is Docker niet beschikbaar.

### 2026-10-17 · Dependabot negeert TypeScript ≥ 7 en `@types/node` ≥ 25

**Keuze:** zie `.github/dependabot.yml`.
**Reden:** `typescript-eslint` ondersteunt TypeScript 7 nog niet, en de Node-typen volgen `.nvmrc` (24).

### 2026-10-17 · Expliciete rechten voor `service_role`

**Keuze:** migratie `20261017000008` kent `service_role` select, insert, update en delete toe op alle tabellen in `public`; op het auditlog alleen select. `beveilig_tabel()` doet dat voortaan voor elke nieuwe tabel, en de fundamenttest controleert het.
**Reden:** nieuwere Supabase-versies kennen nieuwe tabellen niet meer automatisch toe aan `service_role` (gevonden via de e2e-test). Edge Functions hebben die rechten nodig. `service_role` bestaat alleen als secret in Edge Functions (SPEC §1).

## Fase 3 — Rekenmodel

### 2026-10-18 · Alles per werkdag, optellen in de weergave

**Keuze:** `public.capaciteit_per_dag()` en de view `public.toewijzing_dag` rekenen per werkdag (ma–vr). `belasting()`, `belasting_schooljaar` en `belasting_per_periode()` (week of maand) tellen die dagwaarden op. Alle objecten zijn `SECURITY INVOKER`, en views hebben `security_invoker = true`.
**Reden:** SPEC §5. De rekenregels staan op één plek en vallen onder RLS: een lmc ziet alleen de eigen cijfers, en op `aal1` is er niets.

### 2026-10-18 · Vakantie-uren gelijk over de werkdagen van het kalenderjaar

**Keuze:** per werkdag geldt vakantie = uren van het kalenderjaar ÷ het aantal werkdagen (ma–vr) in dat kalenderjaar. Feestdagen tellen in de noemer mee, want 2026 heeft 261 werkdagen (testcase A).
**Reden:** de som over een schooljaar is precies de formule uit SPEC §5. Dezelfde regel werkt ook voor een week of een maand. Op dagen zonder contract kan netto negatief zijn; alleen de som is betekenisvol.

### 2026-10-18 · Overhead per dag; signaalgrenzen op de eerste dag van de periode

**Keuze:** `inzetbaar` rekent elke dag met het `overhead_percentage` dat op die dag geldt. Voor de zone van een periode gelden `grens_vol` en `grens_boven_capaciteit` van de eerste dag van die periode.
**Reden:** bevestigd door de eigenaar ("per dag"). Een zone heeft voor een hele periode één grens nodig.

### 2026-10-18 · Zones

**Keuze:**

- ruimte: < `grens_vol`;
- vol: `grens_vol` t/m `grens_boven_capaciteit`, dus 100% is vol;
- boven_capaciteit: daarboven.

Zonder inzetbare uren (≤ 0) zijn belastingsgraad en zone leeg.
**Reden:** bevestigd door de eigenaar. Een deling door nul of door negatieve uren heeft geen betekenis.

### 2026-10-18 · Verdeling over de dagen

**Keuze:**

- **`schoolweken`:** werkdagen van het schooljaar, zonder feestdagen en zonder schoolvakanties;
- **`looptijd`:** werkdagen van van t/m tot, zonder feestdagen; schoolvakanties tellen mee;
- **`op_datum`:** de opgegeven datums, elk een gelijk deel.

Zonder geschikte dag komen de uren op de eerste dag, met `terugval = true`.
**Reden:** looptijd is bevestigd door de eigenaar; projecten zoals de Kinderboekenweek kunnen ook in vakanties werk geven. De terugval voorkomt dat uren verdwijnen; de UI kan zulke toewijzingen tonen.

### 2026-10-18 · Staffel en opslag

**Keuze:**

- staffeluren = `uren_handmatig`, of anders de staffel bij het aantal leerlingen, × `aandeel_percentage`;
- uitvoering = staffeluren;
- voorbereiding = staffeluren × (opslagfactor − 1);
- ontbreekt een opslagfactor, dan is de factor 1 (geen opslag);
- ontbreekt een staffel, dan zijn er 0 uren.

**Reden:** SPEC §5 ("de opslag telt als voorbereiding_afronding, de staffeluren als uitvoering"). Ontbrekende configuratie geeft zo geen fout, maar zichtbaar 0.

### 2026-10-18 · Testcases op 4 decimalen

**Keuze:** de pgTAP-tests vergelijken testcases A–D op 4 decimalen.
**Reden:** de spec geeft de verwachte waarden zelf afgerond (bijvoorbeeld 155,2107). Er wordt gerekend in `numeric`; afronden gebeurt pas in de weergave.

## Fase 4 — Beheerschermen

### 2026-10-19 · Eén generiek beheerscherm

**Keuze:** `src/beheer/BeheerScherm.tsx` levert overzicht, zoeken, sorteren en een formulierpaneel. Elke tabel is een korte definitie: kolommen, velden, een zod-schema en functies om op te slaan en te verwijderen. Er zijn geen nieuwe dependencies.
**Reden:** het gaat om ongeveer twintig tabellen. Zo werkt elk scherm hetzelfde (toegankelijkheid, foutmeldingen, bevestigen bij verwijderen) en blijft de code klein.

### 2026-10-19 · Validatie aan twee kanten, de database beslist

**Keuze:** zod-schema's in de frontend weerspiegelen de constraints van de database. `vertaalFout()` maakt van databasefouten begrijpelijke meldingen; eigen Nederlandse meldingen uit triggers worden letterlijk getoond.
**Reden:** SPEC §9 ("validatie aan client- én serverzijde"). De frontend voorkomt onnodige verzoeken; de database blijft de autoriteit.

### 2026-10-19 · RPC's voor bewerkingen in één transactie

**Keuze:** drie RPC's, alle drie `SECURITY INVOKER`, zodat RLS geldt:

- `school_opslaan()`: werkpakket en school samen;
- `toewijzing_datums_vervangen()`: de datumlijst in één keer;
- `schooljaar_configuratie_kopieren()`.

**Reden:** twee losse verzoeken kunnen halverwege mislukken en een half record achterlaten, zoals een school zonder schoolgegevens.

### 2026-10-19 · Configuratie kopiëren uit een ander schooljaar

**Keuze:** `schooljaar_configuratie_kopieren(van, naar)` neemt over:

- de staffel;
- de opslagfactoren, die weer "nog te bevestigen" worden;
- de schoolvakanties, met de datums verschoven met het verschil in startdatum en afgekapt op het nieuwe schooljaar.

Het doel-schooljaar moet leeg zijn. Toewijzingen worden niet gekopieerd.
**Reden:** bevestigd door de eigenaar. Alleen vakantienamen kopiëren kan niet, want van en tot zijn verplicht. Daarom worden de datums verschoven en moeten ze daarna worden gecontroleerd. Toewijzingen kopiëren valt buiten deze versie (SPEC §11).

### 2026-10-19 · E-mailadres vast bij een medewerker met account

**Keuze:** de trigger `email_vast` weigert een wijziging van `medewerker.email` als er een profiel (account) bij hoort.
**Reden:** het account-e-mailadres is gelijk aan dat van de medewerker (fase 2). Een wijziging alleen in de tabel `medewerker` zou die twee uit elkaar laten lopen.

### 2026-10-19 · Beheerder ziet werk alleen in

**Keuze:** scholen, activiteiten, projecten en toewijzingen zijn voor de beheerder alleen-lezen. MATT-projecten koppelen mag wel, omdat dat bij de import hoort.
**Reden:** SPEC §6. De frontend verbergt de knoppen; RLS weigert schrijven ook als iemand de frontend omzeilt.

### 2026-10-19 · Signalen bij toewijzingen

**Keuze:** het overzicht toont neutraal:

- "Aandelen van deze school samen …%" als de staffelaandelen niet samen 100% zijn;
- "Geen geschikte dagen" bij een terugval.

**Reden:** de database dwingt 100% niet af (fase 1). Het signaal helpt zonder te beoordelen.

### 2026-10-19 · Beheer apart geladen; grens bundelwaarschuwing 700 kB

**Keuze:** de beheerschermen en de accountpagina worden met `React.lazy` geladen. De grens voor de bundelwaarschuwing staat op 700 kB.
**Reden:** de hoofdbundel bevat React, supabase-js en zod (ongeveer 600 kB, 170 kB gezipt). Verder opsplitsen levert voor de gebruikers weinig op.

### 2026-10-19 · Geen browsertests

**Keuze:** componenten en schema's worden getest met Vitest, data en rechten met pgTAP en de e2e-test. Er is geen Playwright.
**Reden:** bevestigd door de eigenaar: minder dependencies en een snellere CI.

## Fase 5 — MATT-import

### 2026-10-20 · Taakverdeling tussen Edge Function en database

**Keuze:**

- **Edge Function `matt-import`:** controleert rechten, grootte, DOCTYPE/ENTITY, root en namespace; parseert het bestand; controleert subtotalen en periode.
- **RPC `matt_import_concept_opslaan`:** matcht medewerkers met dezelfde `normaliseer_naam()` als de aliassen, maakt onbekende projectnummers aan, bepaalt de categorie en slaat het concept op, alles in één transactie.
- **Definitief maken, terugdraaien en verwerpen:** eigen RPC's.

Alle RPC's zijn SECURITY DEFINER met een rolcontrole (C/M/B op `aal2`) en draaien onder de JWT van de aanroeper.
**Reden:** de matchregel staat op één plek. De database beslist over rechten en transacties, en het auditlog noemt de echte uitvoerder.

### 2026-10-20 · Bestand als ruwe XML, periode in headers

**Keuze:** de frontend stuurt de XML als body (`application/xml`) en de periode in `X-Periode-Van` en `X-Periode-Tot`. De functie bewaart het bestand niet en negeert `schemaLocation`.
**Reden:**

- XML in JSON wordt door alle escapes merkbaar groter, wat de 10 MB-grens zou vertroebelen;
- de periode hoort niet in de URL (SPEC §2).

### 2026-10-20 · `fast-xml-parser` 5.11.1

**Keuze:** XML parsen met `npm:fast-xml-parser@5.11.1`, alleen in de Edge Function, met `processEntities: false`. DOCTYPE en ENTITY zijn dan al vóór het parsen geweigerd.
**Reden:** zelf XML parsen is foutgevoelig. Er is bewust een versie gekozen die al ruim een maand bestaat, niet de nieuwste van drie weken.

### 2026-10-20 · Niet-gematchte namen in een aparte tabel zonder audit

**Keuze:** `matt_import_niet_gematcht` (naam, aantal, uren) bestaat alleen zolang een import concept is. Bij definitief maken wordt hij geleegd, en er zit geen audit-trigger op. `matt_import.aantallen` bevat alleen medewerker-ID's, projectnummers en aantallen.
**Reden:** dataminimalisatie. Met een audit-trigger zouden namen van niet-gematchte personen voor altijd in het append-only auditlog staan.

### 2026-10-20 · Weekendboekingen geaccepteerd

**Keuze:** boekingen op zaterdag en zondag worden geïmporteerd en tellen mee als gerealiseerd.
**Reden:** bevestigd door de eigenaar; dit was het voorstel uit fase 0. Capaciteit rekent per werkdag, maar realisatie is wat er werkelijk geboekt is.

### 2026-10-20 · Terugdraaien verwijdert de boekingen

**Keuze:** bij terugdraaien worden de boekingen en omschrijvingen van de import verwijderd; de import blijft als regel met aantallen in de historie. Boekingen die deze import eerder heeft vervangen, komen niet terug. Het scherm meldt dat bij het terugdraaien.
**Reden:** bevestigd door de eigenaar (dataminimalisatie). Wie die periode weer nodig heeft, importeert hem opnieuw.

### 2026-10-20 · Onbekende artikelcode: opslaan en waarschuwen

**Keuze:** zo'n boeking wordt opgeslagen met een lege categorie; de voorvertoning noemt de artikelcode.
**Reden:** bevestigd door de eigenaar. De uren gaan niet verloren, en de mapping kan worden aangevuld.

### 2026-10-20 · Concepten opruimen

**Keuze:** bij elk nieuw concept worden concepten ouder dan 24 uur verwijderd. Het scherm verwerpt een eerder concept uit dezelfde sessie bij "Opnieuw controleren".
**Reden:** een concept bevat persoonsgegevens (omschrijvingen, niet-gematchte namen) die niet blijven liggen. Automatisch opruimen met `pg_cron` volgt in versie 2.

### 2026-10-20 · View `gerealiseerd`

**Keuze:** `public.gerealiseerd` (security_invoker) bevat de boekingen uit definitieve imports, zonder genegeerde projecten. Voor de status gebruikt hij `private.import_is_definitief()` (SECURITY DEFINER, geeft alleen ja of nee).
**Reden:** de basis voor gepland versus gerealiseerd in fase 6. Een lmc mag `matt_import` zelf niet lezen, maar moet de eigen gerealiseerde uren wel kunnen zien.

### 2026-10-20 · Negatieve fixtures uit een generator

**Keuze:**

- `supabase/functions/matt-import/varianten.ts` maakt `fixtures/matt-varianten/*.xml`;
- `deno task fixtures` maakt ze opnieuw aan;
- een test controleert dat de gecommitte bestanden gelijk zijn aan de generator;
- het te grote bestand (> 10 MB) maakt de test zelf aan.

**Reden:** SPEC §8 ("genereer de negatieve varianten als aparte fixtures op basis van de geldige fixture"). Zo komt er geen 10 MB in de repository.

### 2026-10-20 · Elke UPDATE en DELETE heeft een WHERE (safeupdate)

**Keuze:** in migraties en functies heeft elke `UPDATE` en `DELETE` een `WHERE`, ook bij een tijdelijke tabel. Wie bewust alle rijen raakt, schrijft een betekenisvolle voorwaarde, zoals `where r.id is not null`.
**Reden:** Supabase laadt voor aanvragen via de Data API de extensie `safeupdate`. Die weigert zo'n statement met foutcode 21000, ook binnen een SECURITY DEFINER-functie. pgTAP en PGlite laden deze extensie niet; de e2e-test via de echte API vond de fout wel.

## Fase 6 — Weergaven en deploy

### 2026-10-21 · `gepland_vs_gerealiseerd()` in de database

**Keuze:** één functie (SECURITY INVOKER) geeft per werkpakket en categorie het geplande en gerealiseerde aantal uren, zowel totaal als tot een peildatum (standaard vandaag). Voorbereiding en afronding tellen samen als `voorbereiding_afronding`. Een leeg werkpakket betekent: niet gekoppeld.
**Reden:** SPEC §5 en §9. De rekenregels staan op één plek, RLS geldt, en met een peildatum is het te testen.

### 2026-10-21 · Relatiebeheer: gepland 0

**Keuze:** relatiebeheer staat in de vergelijking met gepland 0 en de toelichting "niet gepland".
**Reden:** het rekenmodel (SPEC §5) kent geen geplande uren voor relatiebeheer, terwijl MATT ze wel boekt.

### 2026-10-21 · Startpagina en teamoverzicht

**Keuze:**

- coordinator, manager en beheerder beginnen bij het teamoverzicht; een lmc bij "Mijn belasting";
- het teamoverzicht toont alleen medewerkers met een contract in het schooljaar, standaard gesorteerd op resterende ruimte (aflopend).

**Reden:** bevestigd door de eigenaar. Het teamoverzicht beantwoordt de vraag "wie heeft ruimte".

### 2026-10-21 · Zone als woord met een grijze balk

**Keuze:** de zone verschijnt steeds als woord, met een neutrale grijze balk; boven capaciteit krijgt een arcering. Er is geen rood, oranje of groen. Een test (`doelbinding.test.ts`) controleert dat de CSS geen rood, oranje of groen bevat en dat de teksten geen beoordelende woorden bevatten.
**Reden:** SPEC §1 (doelbinding) en toegankelijkheid: de informatie zit nooit alleen in een kleur.

### 2026-10-21 · CSP-controle in CI

**Keuze:** na de build controleert CI dat `dist/index.html` de CSP-meta-tag met de juiste `connect-src` bevat, zonder `unsafe-inline` of `unsafe-eval` en zonder inline scripts.
**Reden:** SPEC §2. Een regressie in de build wordt zo direct zichtbaar.

### 2026-10-21 · Testproject inrichten via de CLI

**Keuze:** de eigenaar logt zelf in (`supabase login`, `supabase link` met het databasewachtwoord). Claude voert daarna, na akkoord per stap, `db push --include-seed`, `functions deploy` en `secrets set` uit. De dashboardinstellingen doet de eigenaar. `supabase config push` wordt niet gebruikt.
**Reden:** bevestigd door de eigenaar. Inloggegevens blijven bij de eigenaar. `config push` zou lokale waarden, zoals `site_url` op `127.0.0.1`, naar het testproject sturen.

## Omgeving

### 2026-10-21 · Eén Supabase-project, voorlopig alleen fictieve gegevens

**Keuze:** er is geen apart testproject. Het project **BNWV - LMC APP** (ref `hgpgrqkurnulenqcighy`, eu-west-1) is voorlopig de enige omgeving en bevat **uitsluitend fictieve gegevens**: de seed en de synthetische MATT-fixture. Er komen geen echte medewerkers en geen echte MATT-exports in, tot aan alle voorwaarden voor ingebruikname is voldaan: een betaald plan met back-ups, een verwerkersovereenkomst, akkoord van de FG en akkoord van de OR. Daarvóór wordt de database opgeschoond (zie SETUP.md §5).
**Reden:** besloten door de eigenaar. Het gratis plan staat geen extra actief project toe. Het doel van SPEC §1 ("werk alleen lokaal of tegen het testproject") blijft zo gewaarborgd: zolang dit project alleen fictieve gegevens bevat, fungeert het als testomgeving.

### 2026-10-17 · Zod zonder eval (`jitless`)

**Keuze:** `src/lib/zodConfig.ts` zet `z.config({ jitless: true })` en wordt als eerste geïmporteerd in `main.tsx`.
**Reden:** zod v4 test anders met `new Function` of eval is toegestaan. Onze CSP verbiedt dat (SPEC §2), dus de browser meldt een CSP-schending, ook al vangt zod de fout op. Gevonden tijdens de rondgang in Firefox. Validatie werkt hetzelfde, alleen zonder JIT-optimalisatie.
