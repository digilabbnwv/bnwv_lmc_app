# Handmatige stappen

Stappen die de eigenaar zelf moet uitvoeren, omdat ze niet in code of `supabase/config.toml` kunnen. Vink af wat gedaan is.

## 1. Lokale ontwikkelomgeving

- [ ] Node 24 LTS en npm (bijv. `scoop install nodejs-lts`).
- [ ] Deno 2 (bijv. `scoop install deno`).
- [ ] Supabase CLI ≥ 2.115 (bijv. `scoop install supabase`).
- [ ] Docker Desktop (of een andere Docker-runtime). Nodig voor `supabase start` en `supabase test db`. Op een beheerde laptop kan dit via IT moeten (WSL 2 en beheerrechten).
- [ ] Eenmalig: `npm ci`.

### Omgevingsvariabelen frontend

Maak lokaal een `.env.local` (wordt door git genegeerd) met:

```
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<anon/publishable key uit `supabase status`>
```

Zet hier **nooit** de `service_role`-sleutel in.

## 2. GitHub

Repository: `bnwv_lmc_app` (publiek).

- [ ] **Settings → Code security**: _Secret scanning_ aan, _Push protection_ aan.
- [ ] **Settings → Code security**: _Dependabot alerts_ en _Dependabot security updates_ aan. (Versie-updates staan in `.github/dependabot.yml`.)
- [ ] **Settings → Branches → Add branch ruleset** voor `main`:
  - pull request verplicht vóór merge;
  - verplichte status checks: `frontend`, `database`, `e2e`, `edge-functions` (uit workflow _CI_);
  - force push en verwijderen blokkeren.
- [ ] **Settings → Actions → General**: _Workflow permissions_ op _Read repository contents_; _Allow GitHub Actions to create and approve pull requests_ uit.
- [ ] **Settings → Pages** (pas in fase 6): _Source_ = _GitHub Actions_.
- [ ] **Settings → Secrets and variables → Actions → tabblad _Variables_ → _Repository variables_** (pas in fase 6). Let op: **variabelen**, geen secrets en geen environment-variabelen; de workflow leest `vars.…`.
  - `VITE_SUPABASE_URL` en `VITE_SUPABASE_ANON_KEY` van het Supabase-project;
  - `PAGES_DEPLOY_ENABLED` = `true` om de deploy te activeren.

## 3. Supabase

- [ ] Twee projecten aanmaken in een **EU-regio** (bijv. Frankfurt `eu-central-1`): `bnwv-lmc-test` en `bnwv-lmc-productie`. Ontwikkeling en deploy gaan alleen tegen het testproject.
- [ ] Database-wachtwoorden opslaan in de wachtwoordkluis, niet in de repo.

### Auth-instellingen (per project, in het dashboard)

`supabase/config.toml` regelt dit alleen voor de lokale omgeving. Zet in **beide** projecten:

- [ ] **Authentication → Sign In / Providers → Email**: _Allow new users to sign up_ **uit**; _Confirm email_ aan.
- [ ] **Authentication → Sign In / Providers**: alle overige providers uit (geen Microsoft/Entra in deze versie).
- [ ] **Authentication → Multi-Factor**: TOTP _Enabled_ (enroll en verify).
- [ ] **Authentication → Policies / Passwords**: minimale lengte 12, geen samenstellingseisen.
- [ ] **Leaked password protection** (HaveIBeenPwned) aan. _Betaald plan (Pro)._
- [ ] **Secure password change** aan (her-authenticatie vereist bij wachtwoordwijziging).
- [ ] **Sessions**: _Inactivity timeout_ instellen (voorstel: 8 uur) en _Time-box user sessions_ (voorstel: 12 uur). _Betaald plan (Pro)._
- [ ] **URL Configuration**: _Site URL_ = de GitHub Pages-URL; _Redirect URLs_ alleen die URL.
- [ ] **Wachtwoordherstel per e-mail uit.** Supabase heeft hiervoor geen schakelaar. Maatregelen: de frontend biedt geen herstelfunctie, en de e-mailsjabloon _Reset password_ wordt vervangen door een tekst zonder link ("Neem contact op met een beheerder"). Resetten gaat alleen via de Edge Function `account-resetten` (fase 2).
- [ ] **Rate limits** (Authentication → Rate Limits): standaardwaarden laten staan of verlagen.

### Edge Functions (fase 2)

- [ ] De `service_role`-sleutel is in Edge Functions automatisch beschikbaar als `SUPABASE_SERVICE_ROLE_KEY`. **Nooit** kopiëren naar de frontend, GitHub-secrets of de repo.
- [ ] Toegestane origins instellen (geen geheim, wel per project):

  ```bash
  supabase secrets set --project-ref <test-project-ref> TOEGESTANE_ORIGINS=https://digilabbnwv.github.io
  ```

- [ ] Functies uitrollen naar het **testproject**:

  ```bash
  supabase functions deploy gebruiker-aanmaken account-resetten matt-import --project-ref <test-project-ref>
  ```

### Eerste beheerder (eenmalig per project)

Accounts maak je via de app aan, maar daarvoor is al een manager of beheerder nodig. Maak die ene eerste gebruiker met de hand aan:

1. Zorg dat de medewerker bestaat (tabel `medewerker`, met een e-mailadres binnen `toegestaan_email_domein`).
2. **Authentication → Users → Add user**: het e-mailadres van die medewerker, een sterk tijdelijk wachtwoord, _Auto Confirm User_ aan.
3. **SQL Editor** (vervang de twee waarden):

   ```sql
   insert into public.profiel (gebruiker_id, medewerker_id)
   values ('<id uit Authentication>', (select id from public.medewerker where email = '<e-mail>'));
   insert into public.gebruiker_rol (gebruiker_id, rol) values ('<id uit Authentication>', 'beheerder');
   ```

4. Log in met het tijdelijke wachtwoord. De app vraagt dan om een eigen wachtwoord en om het koppelen van een authenticator-app.

### E-mailsjablonen

- [ ] **Authentication → Emails → Reset password**: vervang de tekst door "Wachtwoordherstel per e-mail is uitgeschakeld. Neem contact op met een beheerder." **zonder** link.
- [ ] **Authentication → Emails → Magic link**: idem (er is geen inlog per e-maillink).

## 4. Project in gebruik nemen met fictieve gegevens (fase 6)

Er is één project: **BNWV - LMC APP** (ref `hgpgrqkurnulenqcighy`). Het bevat tot ingebruikname (§5) **alleen fictieve** gegevens: de seed en de synthetische fixture. Volg de stappen in deze volgorde. Bij stappen met **(eigenaar)** voer je zelf iets in (inloggen, wachtwoord); de andere stappen kan Claude via de CLI uitvoeren, na akkoord per stap.

1. **(eigenaar)** Bewaar het databasewachtwoord van het project in de wachtwoordkluis.
2. **(eigenaar)** In een terminal in de projectmap:

   ```bash
   supabase login
   ```

   ```bash
   supabase link --project-ref hgpgrqkurnulenqcighy
   ```

3. Migraties en de fictieve seed naar het testproject:

   ```bash
   supabase db push --include-seed
   ```

4. Edge Functions en toegestane origins:

   ```bash
   supabase functions deploy gebruiker-aanmaken account-resetten matt-import
   ```

   ```bash
   supabase secrets set TOEGESTANE_ORIGINS=https://digilabbnwv.github.io
   ```

5. **(eigenaar)** Dashboard: de auth-instellingen en e-mailsjablonen uit §3. Site URL en Redirect URL: `https://digilabbnwv.github.io/bnwv_lmc_app/`.
6. **(eigenaar)** Eerste beheerder volgens §3, met een **fictieve** medewerker uit de seed (bijv. `sanne.devries@voorbeeld.test`; het domein `voorbeeld.test` is het toegestane domein in de seed).
7. **(eigenaar)** GitHub → Settings → Secrets and variables → Actions → tabblad _Variables_ → **Repository variables** (niet als _secret_: die ziet de workflow niet, en dan wordt _Deploy Pages_ overgeslagen):
   - `VITE_SUPABASE_URL` = `https://hgpgrqkurnulenqcighy.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = de _anon_ / _publishable_ key (publiek; nooit de `service_role`-sleutel)
   - `PAGES_DEPLOY_ENABLED` = `true`

   En Settings → Pages → Source = _GitHub Actions_.

8. Een push naar `main` (of een merge) start na een groene CI de deploy. Wordt _Deploy Pages_ overgeslagen, controleer dan de variabelen uit stap 7. Staat er op het adres alleen een lege pagina met `/src/main.tsx`, dan publiceert Pages nog vanaf de branch: zet de bron op _GitHub Actions_. De app staat op `https://digilabbnwv.github.io/bnwv_lmc_app/`.
9. Rondgang op laptop én tablet: inloggen, TOTP, beheer, MATT-import met `fixtures/matt-export-synthetisch.xml`, de overzichten, en de browserconsole zonder CSP-meldingen.
10. **Tablets met MDM (JAMF):** controleer bij IT dat JavaScript is toegestaan voor `digilabbnwv.github.io` op de iPads die LMC'ers gebruiken. Bij een eerdere webuitrol stond JavaScript op kiosk-iPads uit; zonder JavaScript werkt de app niet.

## 5. Voor ingebruikname met echte gegevens (buiten deze opdracht)

**Opruimen vóór echte gegevens:** verwijder alle fictieve gegevens (seed, testaccounts, imports van de fixture) of maak een nieuw, leeg project en voer daar alleen de migraties uit (`supabase db push` zónder `--include-seed`). Verwijder ook de fictieve auth-gebruikers.

Betaald Supabase-plan met back-ups, een verwerkersovereenkomst, akkoord van de FG en akkoord van de ondernemingsraad.
