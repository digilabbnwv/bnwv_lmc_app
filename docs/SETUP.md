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
- [ ] **Settings → Secrets and variables → Actions** (pas in fase 6):
  - variabelen `VITE_SUPABASE_URL` en `VITE_SUPABASE_ANON_KEY` van het **testproject**;
  - variabele `PAGES_DEPLOY_ENABLED` = `true` om de deploy te activeren.

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
  supabase functions deploy gebruiker-aanmaken account-resetten --project-ref <test-project-ref>
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

## 4. Voor ingebruikname met echte gegevens (buiten deze opdracht)

Betaald Supabase-plan met back-ups, een verwerkersovereenkomst, akkoord van de FG en akkoord van de ondernemingsraad.
