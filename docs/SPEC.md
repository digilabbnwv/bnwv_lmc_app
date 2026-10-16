# Opdracht: LMC-capaciteitsapp (Bibliotheek Noordwest Veluwe)

Je bent de ontwikkelaar van een nieuwe webapplicatie voor team Programmering van Bibliotheek Noordwest Veluwe (BNWV). Dit document is de volledige specificatie. Lees het helemaal voordat je iets doet.

## 0. Werkwijze — lees dit eerst

1. **Werk in fasen (zie §12). Stop na elke fase.** Laat zien wat je gedaan hebt, welke tests draaien en welke keuzes je hebt gemaakt, en wacht op akkoord voordat je aan de volgende fase begint.
2. **Begin met een plan.** Maak voor fase 0 eerst een plan en leg het voor. Schrijf pas code na akkoord.
3. **Leg deze specificatie vast in de repository:**
   - `docs/SPEC.md`: dit document, ongewijzigd.
   - `CLAUDE.md`: de vaste werkregels uit §1 en §2, kort en bondig, zodat ze in elke sessie gelden.
   - `docs/DECISIONS.md`: elke ontwerpkeuze die niet in de specificatie staat, met datum, keuze en reden.
   - `docs/SETUP.md`: alle handmatige stappen die de eigenaar zelf moet doen (Supabase-dashboard, GitHub-instellingen).
4. **Bij twijfel: vragen, niet aannemen.** Als de specificatie iets niet regelt of tegenstrijdig is, stel een vraag.
5. **Tests zijn onderdeel van "klaar".** Een fase is pas af als de bijbehorende tests bestaan en slagen.

## 1. Harde regels voor beveiliging en privacy

Deze regels gaan boven alles. Wijk er nooit van af, ook niet tijdelijk.

- **De repository is publiek.** Commit nooit:
  - geheimen: de `service_role`-sleutel, wachtwoorden, tokens of `.env`-bestanden;
  - echte persoonsgegevens: namen van echte medewerkers of echte MATT-exports.
- **Alleen synthetische testdata.** Gebruik de meegeleverde `matt-export-synthetisch.xml` en zelf gegenereerde fictieve data. Echte exportbestanden komen nooit in de repository.
- **Werk alleen lokaal of tegen het testproject.** Gebruik de lokale Supabase-omgeving (`supabase start`) of het testproject. Maak nooit verbinding met een productieproject.
- **De `service_role`-sleutel bestaat alleen in Edge Functions**, als secret. Nooit in frontend-code, nooit in de repository.
- **Row Level Security (RLS) staat aan op élke tabel**, met "niets mag, tenzij". Elke nieuwe tabel krijgt in dezelfde migratie RLS-policies én pgTAP-tests.
- **Autorisatie zit in de database, niet in de frontend.** De frontend verbergt alleen; de database beslist.
- **Rollen staan in een eigen tabel.** Gebruik nooit `user_metadata` voor autorisatie: die kan een gebruiker zelf wijzigen.
- **Functies met `SECURITY DEFINER`** krijgen altijd `SET search_path = ''` en volledig gekwalificeerde namen. Views krijgen `WITH (security_invoker = true)`.
- **Dataminimalisatie.** Sla niets op dat niet nodig is. Afwezigheid wordt nooit met een reden vastgelegd: geen ziekte, geen verlofsoort.
- **Doelbinding.** De app dient capaciteitsplanning en werkverdeling, niet beoordeling of controle. Gebruik geen teksten, kleuren of functies die prestaties beoordelen, zoals "achterstand" of "te weinig". Deze tekst staat zichtbaar in de app, bijvoorbeeld in de footer of op een infopagina:
  > Dit overzicht is bedoeld voor capaciteitsplanning en een eerlijke werkverdeling. Het is geen middel om prestaties te beoordelen.

## 2. Technische uitgangspunten

| Onderdeel | Keuze |
|---|---|
| Frontend | Vite + React + TypeScript (strict), React Router met `HashRouter` (vanwege GitHub Pages), TanStack Query, zod voor validatie |
| Backend | Supabase: Postgres, Auth en Edge Functions (TypeScript/Deno) |
| Databasetypes | Gegenereerd met `supabase gen types` |
| Tests | pgTAP (`supabase test db`) voor schema, RLS en rekenfuncties; Vitest voor de frontend; Deno-tests voor Edge Functions |
| Hosting | Frontend op GitHub Pages, gepubliceerd via GitHub Actions; backend op Supabase in een EU-regio |
| CI | GitHub Actions: lint, typecheck, alle tests, daarna pas deploy. Deploy alleen vanaf `main`. |
| Afhankelijkheden | Lockfile committen, Dependabot aan, minimaal aantal dependencies |
| Taal | UI in het Nederlands. Tabel- en kolomnamen in het Nederlands, snake_case, zonder diakrieten. Commentaar in het Nederlands. |

**Frontend-beveiliging.** GitHub Pages kan geen eigen headers zetten. Neem daarom een Content Security Policy op via `<meta http-equiv="Content-Security-Policy">`:
- `default-src 'self'`;
- `connect-src` alleen naar de eigen Supabase-URL;
- geen `unsafe-inline` voor scripts, geen `eval`.

Zet geen gevoelige gegevens in URL's of querystrings. Gebruik geen `localStorage` voor iets anders dan de Supabase-sessie.

## 3. Context en probleem

Team Programmering heeft een groep leesmediacoaches (LMC'ers). Elke LMC'er heeft contracturen en voert verschillende taken uit:
- **dBos-scholen**: PO, VO en BoekStart, met uren op jaarbasis volgens een staffel op basis van het aantal leerlingen, plus een opslag voor voorbereiding;
- **terugkerende activiteiten**: Digilab, Boekjes & Babbels, Peuterbieb;
- **projecten**: Nationale Voorleesdagen, Kinderboekenweek, enzovoort.

Er is geen centraal overzicht van wie hoeveel ruimte heeft. De app moet laten zien:
1. wie nog ruimte heeft voor een nieuwe school, een nieuw project of een incidentele activiteit;
2. hoe de belasting was in een afgelopen periode: gepland tegenover gerealiseerd (geboekt in MATT).

**Het schooljaar (1 augustus t/m 31 juli) is de centrale periode.**

## 4. Domeinmodel

Het model hieronder geeft de bedoeling weer. Je mag de namen verfijnen als je dat vastlegt in `DECISIONS.md`.

**Configuratie**

- `schooljaar`: naam (bijv. "2026-2027"), startdatum, einddatum.
- `schoolvakantie`: schooljaar, naam, van, tot.
- `feestdag`: datum, naam.
- `staffel`: schooljaar, schooltype (PO / VO / BoekStart), leerlingen_min, leerlingen_max, uren.
- `opslagfactor`: schooljaar, schooltype, factor (decimaal). In de seed: 2,0 voor alle typen, gemarkeerd als "nog te bevestigen".
- `instelling`: sleutel–waarde met een ingangsdatum. Gebruik dit voor `overhead_percentage` (seed: 15) en de signaalgrenzen `grens_vol` (85) en `grens_boven_capaciteit` (100).

**Medewerkers**

- `medewerker`: voornaam, achternaam, e-mail, actief. Optioneel gekoppeld aan `auth.users`.
- `contract`: medewerker, uren per week, geldig_van, geldig_tot (leeg betekent doorlopend). Periodes van één medewerker mogen elkaar niet overlappen; dwing dat af met een exclusion constraint.
- `vakantie_uren`: medewerker, kalenderjaar, uren. HR levert per kalenderjaar; het systeem rekent om naar schooljaar (zie §5).
- `niet_beschikbaar`: medewerker, van, tot, beschikbaarheidspercentage (0–100). **Er is geen veld voor de reden.**
- `medewerker_alias`: medewerker, bron (`matt` / `planning`), alias. Matching gebeurt op de genormaliseerde vorm: trim, meerdere spaties samenvoegen, kleine letters.

**Werk**

- `werkpakket`: de gedeelde basis voor alles wat uren kost. Velden: soort (`school` / `activiteit` / `project`), naam, vestiging (HAR / ERM / NUN / PUT / ELS / overig), actief.
- `school`: 1-op-1 extensie van een werkpakket met soort `school`. Velden: NAW-gegevens, schooltype (PO / VO / BoekStart).
- `school_schooljaar`: school, schooljaar, aantal leerlingen. De staffeluren worden afgeleid; een handmatige afwijking mag, maar vraagt een verplichte toelichting.
- `activiteittype`: naam (Digilab, Boekjes & Babbels, Peuterbieb, ...), normuren_uitvoering, normuren_voorbereiding, normuren_afronding. Normuren gelden per keer.
- `matt_project`: projectnummer (uniek), naam_laatst_gezien, werkpakket (mag leeg zijn), genegeerd (boolean). Eén werkpakket kan meerdere MATT-projecten hebben.
- `toewijzing`: medewerker, werkpakket, schooljaar, en verder:
  - gepland_uitvoering, gepland_voorbereiding, gepland_afronding;
  - bron van de uren: `staffel`, `norm_x_aantal` of `handmatig`;
  - aantal_keer (voor activiteiten);
  - verdeling: `schoolweken`, `looptijd` (van/tot) of `op_datum` (lijst met datums);
  - toelichting.

  Meerdere medewerkers op hetzelfde werkpakket is normaal.

**Realisatie**

- `matt_import`: uitgevoerd_door, tijdstip, periode_van, periode_tot, aantallen, totaal_uren, status (`concept` / `definitief` / `teruggedraaid`).
- `boeking`: import, medewerker, matt_project, artikelcode, categorie, datum, uren, uren_open.
- `boeking_omschrijving`: boeking (1-op-1), omschrijving. Dit staat in een **aparte tabel** om de omschrijving voor de manager af te schermen (§6).
- `matt_artikel_mapping`: artikelcode → categorie. Seed:
  - `10` → `uitvoering`
  - `11` → `voorbereiding_afronding`
  - `12` → `relatiebeheer`

**Systeem**

- `gebruiker_rol`: gebruiker, rol (`lmc` / `coordinator` / `manager` / `beheerder`). Een gebruiker kan meerdere rollen hebben.
- `profiel`: gebruiker, medewerker, moet_wachtwoord_wijzigen.
- `auditlog`: tijdstip, gebruiker, actie, tabel, record_id, oude en nieuwe waarde (jsonb). **Append-only**: er bestaan geen policies voor update of delete, ook niet voor beheerders.

## 5. Rekenmodel

**Intern rekenen we per werkdag (ma–vr). De weergave telt op per week, maand of schooljaar.** Implementeer de berekening in Postgres-functies en -views, zodat de rekenregels op één plek staan en onder RLS vallen.

**Capaciteit van een medewerker in een periode:**
1. Per werkdag:
   - is het een feestdag, dan is de capaciteit 0;
   - anders: (contracturen per week van het contract dat op die dag geldt ÷ 5) × beschikbaarheidspercentage op die dag (standaard 100%).
2. Bruto beschikbaar = de som over alle werkdagen.
3. Vakantie-uren per schooljaar: het deel van elk betrokken kalenderjaar, naar rato van het aantal werkdagen. Een kalenderjaar draagt dus bij met (werkdagen van dat kalenderjaar binnen het schooljaar ÷ werkdagen in dat hele kalenderjaar) × de vakantie-uren van dat jaar.
4. Netto beschikbaar = bruto − vakantie-uren.
5. **Inzetbaar = netto × (1 − overhead_percentage ÷ 100).**

**Geplande belasting:**
- **School**: staffeluren (op basis van leerlingen en schooltype in dat schooljaar) × opslagfactor. Verdeling `schoolweken`: gelijk over de werkdagen van het schooljaar die geen schoolvakantie en geen feestdag zijn. In de vergelijking met MATT (§9) wordt de opslag als voorbereiding_afronding geteld en de staffeluren als uitvoering.
- **Activiteit**: aantal_keer × normuren, verdeeld volgens de toewijzing.
- **Project**: de handmatig toegewezen uren, verdeeld over de looptijd.

**Belastingsgraad = gepland ÷ inzetbaar.** De signaalzones zijn:
- *ruimte*: onder `grens_vol`;
- *vol*: tussen `grens_vol` en `grens_boven_capaciteit`;
- *boven capaciteit*: daarboven.

Gebruik neutrale kleuren en labels.

**Verplichte testcases (pgTAP).** Schooljaar 2026-2027 (1-8-2026 t/m 31-7-2027), met deze testfeestdagen: 25-12-2026, 26-12-2026 (een zaterdag, telt dus niet mee), 1-1-2027, 29-3-2027, 27-4-2027, 6-5-2027 en 17-5-2027.

- **Testcase A** — 24 uur/week, het hele jaar, vakantie 150 uur (2026) en 160 uur (2027), overhead 15%:
  - werkdagen 260, waarvan 6 feestdagen op een werkdag;
  - bruto = 260 × 4,8 − 6 × 4,8 = 1219,2;
  - vakantie = 150 × 109/261 + 160 × 151/261 = 155,2107;
  - netto = 1063,9893;
  - **inzetbaar = 904,3909**.
- **Testcase B** — contract 24 uur t/m 31-12-2026 en 28 uur vanaf 1-1-2027, verder gelijk aan A:
  - bruto = 109 × 4,8 + 151 × 5,6 − (1 × 4,8 + 5 × 5,6) = 1336,0;
  - netto = 1180,7893;
  - **inzetbaar = 1003,6709**.
- **Testcase C** — school PO met staffel 50 uur en factor 2,0: gepland 100 uur, gelijk verdeeld over de schoolweken.
- **Testcase D** — niet beschikbaar voor 50% gedurende 10 werkdagen zonder feestdag in 2027 bij 28 uur/week: de bruto capaciteit neemt af met 28 uur.

Afronding: rekenen in `numeric`, pas afronden in de weergave (1 decimaal).

## 6. Rollen en rechten

| Recht | lmc | coordinator | manager | beheerder |
|---|:-:|:-:|:-:|:-:|
| Eigen belasting en boekingen inzien (incl. eigen omschrijvingen) | ✓ | ✓ | ✓ | ✓ |
| Belasting van alle medewerkers inzien | – | ✓ | ✓ | ✓ |
| Omschrijvingen van boekingen van anderen inzien | – | ✓ | – | ✓ |
| Scholen, activiteiten, projecten en toewijzingen beheren | – | ✓ | ✓ | – |
| Medewerkers, contracten, aliassen, beschikbaarheid beheren | – | ✓ | ✓ | ✓ |
| Imports uitvoeren en terugdraaien | – | ✓ | ✓ | ✓ |
| Configuratie (schooljaren, staffel, factoren, percentages, vakanties) | – | ✓ | ✓ | ✓ |
| Gebruikers aanmaken, rollen toekennen, accounts resetten | – | – | ✓ | ✓ |
| Auditlog inzien | – | – | ✓ | ✓ |

Aanvullende regels:
- **Alle toegang tot gegevens vereist `aal2`** (tweestapsverificatie), voor elke rol. Controleer dat via `auth.jwt() ->> 'aal'` in de RLS-hulpfuncties.
- **Een gebruiker zonder rol of zonder gekoppelde medewerker ziet niets.**
- **Het bekijken van boekingdetails van een ánder** loopt via een RPC-functie die het opvragen in het auditlog schrijft.
- **Schrijf pgTAP-tests per rol en per tabel**, voor lezen, toevoegen, wijzigen en verwijderen, zowel toegestaan als geweigerd. Daar hoort expliciet ook bij:
  - lmc A kan gegevens van lmc B niet opvragen, ook niet via een ander ID;
  - de manager kan `boeking_omschrijving` van anderen niet lezen;
  - een sessie op `aal1` krijgt niets terug.

## 7. Authenticatie

Gebruik e-mail met wachtwoord en verplichte TOTP. Er is **geen** inlog via Microsoft/Entra ID; bouw de inlog wel zo dat een OAuth-provider later kan worden toegevoegd zonder het datamodel te wijzigen.

- **Zelf registreren staat uit.** Wachtwoordherstel per e-mail staat uit.
- **Account aanmaken** gebeurt via de Edge Function `gebruiker-aanmaken`:
  - alleen voor manager en beheerder, op `aal2`;
  - het e-mailadres wordt gecontroleerd tegen een toegestaan domein uit `instelling`;
  - de functie genereert een sterk tijdelijk wachtwoord, zet `email_confirm` op true en `moet_wachtwoord_wijzigen` op true, en geeft het wachtwoord één keer terug.
- **Eerste keer inloggen**:
  1. een nieuw wachtwoord kiezen (minimaal 12 tekens, geen samenstellingsregels);
  2. een TOTP-factor koppelen;
  3. pas daarna is er toegang. Bied de mogelijkheid een tweede toestel te koppelen.
- **Account resetten** gebeurt via de Edge Function `account-resetten`:
  - alleen voor manager en beheerder, op `aal2`;
  - de functie verwijdert alle MFA-factoren, zet een nieuw tijdelijk wachtwoord en logt de reset in het auditlog;
  - **een gebruiker kan zijn eigen account niet resetten.**
- **Deactiveren** van een medewerker trekt ook de toegang direct in.
- **Instellingen die alleen in het Supabase-dashboard of op een betaald plan kunnen** komen in `docs/SETUP.md`. Denk aan gelekte-wachtwoordcontrole, time-out bij inactiviteit en `secure password change`. Zet in `supabase/config.toml` wat daar kan.

## 8. MATT-import

**Formaat.** De bron is een SQL Server Reporting Services-export in XML (UTF-8 met BOM, één regel, default namespace `Project_x0020_uren_x0020_per_x0020_projectmanager_x0020_status`). Zie de meegeleverde `fixtures/matt-export-synthetisch.xml`. De hiërarchie:

```
Report > Tablix1 > project_Collection > project[@project = projectnummer]
  > Projectoms[@Projectoms = projectnaam]
    > artikel_Collection > artikel[@artikel = artikelcode]
      > artikeloms[@artikeloms = artikelnaam,
                   @Textbox22 = som uren_open, @Textbox6 = som verwerkt,
                   @Textbox33 = som uren, @Textbox34 = som nacalc]
        > Details_Collection > Details[@datum, @medewerker, @omschrijving,
                                       @uren_open, @Textbox4 (verwerkt), @uren, @nacalc]
    > Textbox23 > Textbox43[@Textbox29 open, @Textbox8 verwerkt,
                            @Textbox27 uren, @Textbox28 nacalc]   (subtotalen per project)
Report > Tablix1 > Textbox15 > Textbox39 > Textbox16
  > Textbox44[@Textbox35 open, @Textbox10 verwerkt,
              @Textbox20 uren, @Textbox21 nacalc]   (eindtotaal)
```

Een paar eigenschappen van dit formaat:
- `medewerker` is opgevuld met spaties tot 64 tekens.
- Projectnamen zijn inconsistent (`-HAR`, ` - HAR`, `De Ceder -NUN`). **Match daarom nooit op projectnaam, alleen op projectnummer.**
- Getallen gebruiken een punt als decimaalteken.
- `uren` = verwerkt + `uren_open`. Sla `uren` op als totaal en `uren_open` apart.
- Het bestand bevat geen periodegegevens.

**Uitvoering: Edge Function `matt-import`.** Alleen voor coordinator, manager en beheerder, op `aal2`.

1. **Validatie vóór het parsen.** Maximaal 10 MB. Weiger het bestand als het `<!DOCTYPE` of `<!ENTITY` bevat (bescherming tegen XXE en entity expansion). Controleer de namespace en het root-element.
2. **Parsen en controleren.** Controleer per artikel, per project en voor het eindtotaal of de subtotalen gelijk zijn aan de som van de boekingen, met tolerantie 0,001. Bij een afwijking stopt de import met een duidelijke foutmelding.
3. **Periode.** De gebruiker geeft `periode_van` en `periode_tot` op. Boekingen buiten die periode leiden tot een foutmelding.
4. **Matchen.**
   - Medewerkers via `medewerker_alias` (bron `matt`, genormaliseerd). **Boekingen van niet-gematchte namen worden niet opgeslagen.** De voorvertoning toont alleen de naam en het aantal boekingen en uren, zodat er een alias kan worden toegevoegd.
   - Projecten via `matt_project.projectnummer`. Is een nummer onbekend, dan wordt het aangemaakt zonder werkpakket ("niet gekoppeld") en worden de boekingen wél opgeslagen. Ze verschijnen in een beheerlijst "niet-gekoppelde MATT-projecten". Projecten met `genegeerd = true` worden niet meegenomen in de belasting.
5. **Voorvertoning.** Sla de import op als `concept` en toon:
   - aantallen en uren per gematchte medewerker;
   - de niet-gematchte namen;
   - de onbekende projectnummers, met de uren die daardoor nog niet aan een werkpakket hangen.
6. **Definitief maken.** Na bevestiging worden, in één transactie, alle bestaande boekingen van de gematchte medewerkers binnen de periode verwijderd en vervangen door de nieuwe. Daardoor ontstaan bij een tweede import nooit dubbele boekingen. Dit wordt gelogd in het auditlog.
7. **Terugdraaien.** Een definitieve import kan in zijn geheel worden teruggedraaid. Teruggedraaide boekingen tellen niet meer mee.
8. **Het originele bestand wordt niet bewaard.** De `schemaLocation` (interne servernaam, sessie-ID) wordt genegeerd.

**Tests (Deno).** Neem tests op voor:
- de geldige synthetische fixture;
- een bestand met een afwijkend subtotaal;
- een bestand met `<!DOCTYPE`;
- een te groot bestand;
- een verkeerde namespace;
- een boeking buiten de periode;
- een niet-gematchte medewerker (de fixture bevat "Testpersoon Onbekend");
- een onbekend projectnummer (de fixture bevat 999);
- een tweede import van hetzelfde bestand, die geen duplicaten mag opleveren.

Genereer de negatieve varianten als aparte fixtures op basis van de geldige fixture.

## 9. Weergaven

- **Mijn belasting** (lmc): inzetbaar, gepland en gerealiseerd voor het gekozen schooljaar, de belastingsgraad met signaalzone, en een lijst van toewijzingen.
- **Teamoverzicht** (coordinator, manager, beheerder): een tabel per medewerker met contracturen, inzetbaar, gepland, resterende ruimte in uren, belastingsgraad en zone. Te sorteren op ruimte. Dit beantwoordt de vraag "wie heeft ruimte".
- **Gepland versus gerealiseerd**, per medewerker en schooljaar:
  - de categorieën uitvoering, voorbereiding_afronding en relatiebeheer;
  - per werkpakket via de koppeling met `matt_project`;
  - de uren op niet-gekoppelde projecten apart zichtbaar;
  - "tot vandaag": het geplande deel tot vandaag (op basis van de dagverdeling) naast het gerealiseerde.
- **Beheerschermen** voor alle tabellen uit §4, met validatie aan client- én serverzijde.
- Toegankelijk (WCAG 2.1 AA als richtlijn), bruikbaar op laptop en tablet.

## 10. Auditlog en bewaartermijn

- Triggers op alle tabellen met inhoudelijke gegevens schrijven naar `auditlog`.
- De bewaartermijn wordt nog niet geautomatiseerd, maar leg wel het ontwerp vast in `DECISIONS.md`: detailboekingen en omschrijvingen blijven het lopende plus twee voorgaande schooljaren bewaard, daarna alleen totalen per medewerker per schooljaar. Het is bedoeld voor `pg_cron` in versie 2.

## 11. Afbakening

**In deze versie:** alles uit §4 tot en met §10.

**Niet in deze versie** (wel rekening mee houden in het ontwerp):
- import van het planningsdocument (Excel); het formaat wordt nog aangepast;
- een wizard voor de overgang naar een nieuw schooljaar (toewijzingen kopiëren als concept);
- uitgebreide grafieken;
- export van eigen gegevens (inzagerecht);
- geautomatiseerde bewaartermijn;
- OAuth-login.

## 12. Fasering

Stop na elke fase en wacht op akkoord.

**Fase 0 — Fundament**
- Repository-structuur, `CLAUDE.md`, `docs/`, `.gitignore`. Negeer in elk geval `.env*`, `*.xml` en `*.xlsx`, behalve onder `fixtures/` en `supabase/tests/`.
- Vite-project, ESLint en Prettier, TypeScript strict.
- Lokale Supabase via de CLI.
- GitHub Actions voor lint, typecheck en tests, en een (nog niet actieve) Pages-deploy.
- `docs/SETUP.md` met de handmatige stappen:
  - GitHub: secret scanning en push protection aan, branch protection op `main`, Dependabot aan;
  - Supabase: twee projecten (test en productie) in een EU-regio, en de auth-instellingen uit §7.
- Klaar als: CI draait groen op een leeg project.

**Fase 1 — Database en RLS**
- Alle migraties voor §4, de RLS-hulpfuncties (`heeft_rol()`, `is_aal2()`, `eigen_medewerker_id()`) en alle policies.
- Audit-triggers.
- Seed met fictieve medewerkers die overeenkomen met de namen in de synthetische fixture, plus fictieve scholen en een staffel.
- Klaar als: pgTAP-tests voor alle rollen en tabellen uit §6 bestaan en slagen.

**Fase 2 — Authenticatie**
- Inlogscherm, verplichte wachtwoordwijziging, TOTP-koppeling (inclusief tweede toestel).
- De Edge Functions `gebruiker-aanmaken` en `account-resetten`.
- Klaar als: tests bewijzen dat zonder `aal2` niets toegankelijk is en dat iemand zijn eigen account niet kan resetten.

**Fase 3 — Rekenmodel**
- Postgres-functies en -views voor capaciteit en belasting.
- Klaar als: de testcases A tot en met D uit §5 exact slagen.

**Fase 4 — Beheerschermen**
- CRUD-schermen voor configuratie, medewerkers, scholen, activiteittypes, projecten, MATT-projecten en toewijzingen.

**Fase 5 — MATT-import**
- Edge Function en UI (upload, periode opgeven, voorvertoning, definitief maken, terugdraaien), plus de beheerlijst niet-gekoppelde projecten.
- Klaar als: alle tests uit §8 slagen.

**Fase 6 — Weergaven en deploy**
- De schermen uit §9, met de CSP-meta-tag.
- Deploy naar GitHub Pages tegen het **testproject**.
- Een korte gebruikershandleiding in `docs/HANDLEIDING.md`.

**Na fase 6, en buiten jouw opdracht:** ingebruikname met echte gegevens gebeurt pas na het betaalde Supabase-plan met back-ups, een verwerkersovereenkomst, akkoord van de FG en van de ondernemingsraad. Schrijf geen code die daarop vooruitloopt.

---

Begin nu met fase 0: lees de meegeleverde fixture, maak een plan en leg dat voor.
