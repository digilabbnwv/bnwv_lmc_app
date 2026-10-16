-- Authenticatie: status vóór toegang, rechtencontrole, account resetten,
-- wachtwoordvlag en het beëindigen van sessies (SPEC §7).
begin;
create extension if not exists pgtap with schema extensions;
select * from no_plan();

select tests.maak_personas();

-- Een sessie met refresh token voor lmc B en voor de gedeactiveerd-te-worden coordinator.
insert into auth.sessions (id, user_id) values
  ('00000000-0000-4000-8000-00000000c001', tests.gb('lmc_b')),
  ('00000000-0000-4000-8000-00000000c002', tests.gb('coordinator'));
insert into auth.refresh_tokens (token, user_id, session_id, revoked) values
  ('test-token-b', tests.gb('lmc_b')::text, '00000000-0000-4000-8000-00000000c001', false),
  ('test-token-c', tests.gb('coordinator')::text, '00000000-0000-4000-8000-00000000c002', false);

-- ---------------------------------------------------------------------------
-- mijn_status(): alleen eigen vlaggen, ook op aal1
-- ---------------------------------------------------------------------------

select is(
  tests.waarde('lmc_a_aal1', 'select public.mijn_status()'),
  '{"heeft_toegang_na_mfa": true, "moet_wachtwoord_wijzigen": false}',
  'mijn_status werkt op aal1 en geeft alleen eigen vlaggen'
);

select is(
  tests.waarde('moet_wijzigen', 'select public.mijn_status()'),
  '{"heeft_toegang_na_mfa": true, "moet_wachtwoord_wijzigen": true}',
  'mijn_status meldt dat het wachtwoord gewijzigd moet worden'
);

select is(
  tests.waarde('zonder_rol', 'select public.mijn_status()'),
  '{"heeft_toegang_na_mfa": false, "moet_wachtwoord_wijzigen": false}',
  'mijn_status meldt dat een gebruiker zonder rol geen toegang krijgt'
);

select is(
  tests.waarde('inactief', 'select public.mijn_status()'),
  '{"heeft_toegang_na_mfa": false, "moet_wachtwoord_wijzigen": false}',
  'mijn_status meldt dat een gedeactiveerde medewerker geen toegang krijgt'
);

select is(
  tests.waarde('anon', 'select public.mijn_status()'),
  'geweigerd',
  'anon kan mijn_status niet aanroepen'
);

-- ---------------------------------------------------------------------------
-- mag_gebruikers_beheren(): alleen manager en beheerder op aal2
-- ---------------------------------------------------------------------------

select is(tests.waarde('manager', 'select public.mag_gebruikers_beheren()'), 'true',
  'Manager op aal2 mag accounts beheren');
select is(tests.waarde('beheerder', 'select public.mag_gebruikers_beheren()'), 'true',
  'Beheerder op aal2 mag accounts beheren');
select is(tests.waarde('manager_aal1', 'select public.mag_gebruikers_beheren()'), 'false',
  'Manager op aal1 mag geen accounts beheren');
select is(tests.waarde('coordinator', 'select public.mag_gebruikers_beheren()'), 'false',
  'Coordinator mag geen accounts beheren');
select is(tests.waarde('lmc_a', 'select public.mag_gebruikers_beheren()'), 'false',
  'lmc mag geen accounts beheren');
select is(tests.waarde('moet_wijzigen', 'select public.mag_gebruikers_beheren()'), 'false',
  'Manager die eerst zijn wachtwoord moet wijzigen, mag geen accounts beheren');
select is(tests.waarde('anon', 'select public.mag_gebruikers_beheren()'), 'geweigerd',
  'anon kan mag_gebruikers_beheren niet aanroepen');

-- ---------------------------------------------------------------------------
-- account_reset_voorbereiden()
-- ---------------------------------------------------------------------------

select is(
  tests.probeer('manager', $$select public.account_reset_voorbereiden(tests.gb('manager'))$$),
  'geweigerd',
  'Manager kan zijn eigen account niet resetten'
);

select is(
  tests.probeer('beheerder', $$select public.account_reset_voorbereiden(tests.gb('beheerder'))$$),
  'geweigerd',
  'Beheerder kan zijn eigen account niet resetten'
);

select is(
  tests.probeer('lmc_a', $$select public.account_reset_voorbereiden(tests.gb('lmc_b'))$$),
  'geweigerd',
  'lmc kan geen account resetten'
);

select is(
  tests.probeer('coordinator', $$select public.account_reset_voorbereiden(tests.gb('lmc_b'))$$),
  'geweigerd',
  'Coordinator kan geen account resetten'
);

select is(
  tests.probeer('manager_aal1', $$select public.account_reset_voorbereiden(tests.gb('lmc_b'))$$),
  'geweigerd',
  'Op aal1 kan niemand een account resetten'
);

select is(
  tests.probeer('anon', $$select public.account_reset_voorbereiden(tests.gb('lmc_b'))$$),
  'geweigerd',
  'anon kan geen account resetten'
);

select is(
  tests.probeer('manager', $$select public.account_reset_voorbereiden(tests.gb('beheerder'))$$),
  'geweigerd',
  'Manager kan een beheerder niet resetten'
);

select matches(
  tests.probeer('manager', $$select public.account_reset_voorbereiden(tests.gb('lmc_b'))$$),
  '^rijen:1$',
  'Manager kan het account van een ander resetten'
);

-- Nu echt uitvoeren als manager.
do $$
begin
  perform tests.wissel('manager');
  perform public.account_reset_voorbereiden(tests.gb('lmc_b'));
end
$$;
reset role;

select is(
  (select moet_wachtwoord_wijzigen from public.profiel where gebruiker_id = tests.gb('lmc_b')),
  true,
  'Na een reset moet het wachtwoord opnieuw gewijzigd worden'
);

select is_empty(
  $$select 1 from auth.sessions where user_id = tests.gb('lmc_b')$$,
  'Na een reset zijn alle sessies beëindigd'
);

select is_empty(
  $$select 1 from auth.refresh_tokens where user_id = tests.gb('lmc_b')::text$$,
  'Na een reset zijn alle refresh tokens vervallen'
);

select ok(
  exists (
    select 1 from public.auditlog
    where actie = 'account_reset' and record_id = tests.gb('lmc_b')::text
      and gebruiker_id = tests.gb('manager')
  ),
  'De reset staat in het auditlog met de uitvoerder'
);

select matches(
  tests.aantal('lmc_b', 'select * from public.medewerker'),
  '^rijen:0$',
  'Een nog geldig token van een gereset account geeft geen toegang meer'
);

select ok(
  exists (select 1 from auth.sessions where user_id = tests.gb('coordinator')),
  'Sessies van anderen blijven bestaan'
);

-- ---------------------------------------------------------------------------
-- Wachtwoordvlag via de trigger op auth.users
-- ---------------------------------------------------------------------------

update auth.users set encrypted_password = 'nieuwe-hash' where id = tests.gb('lmc_b');
select is(
  (select moet_wachtwoord_wijzigen from public.profiel where gebruiker_id = tests.gb('lmc_b')),
  false,
  'Een gewijzigd wachtwoord zet de wachtwoordvlag uit'
);

update public.profiel set moet_wachtwoord_wijzigen = true where gebruiker_id = tests.gb('lmc_b');
update auth.users set email = email where id = tests.gb('lmc_b');
select is(
  (select moet_wachtwoord_wijzigen from public.profiel where gebruiker_id = tests.gb('lmc_b')),
  true,
  'Een andere wijziging aan de gebruiker laat de wachtwoordvlag staan'
);

update auth.users set encrypted_password = encrypted_password where id = tests.gb('lmc_b');
select is(
  (select moet_wachtwoord_wijzigen from public.profiel where gebruiker_id = tests.gb('lmc_b')),
  true,
  'Hetzelfde wachtwoord opnieuw opslaan telt niet als wijziging'
);

-- ---------------------------------------------------------------------------
-- Deactiveren beëindigt sessies
-- ---------------------------------------------------------------------------

do $$
begin
  perform tests.wissel('manager');
  update public.medewerker set actief = false where id = tests.mw('coordinator');
end
$$;
reset role;

select is_empty(
  $$select 1 from auth.sessions where user_id = tests.gb('coordinator')$$,
  'Deactiveren van een medewerker beëindigt de sessies van het account'
);

select is_empty(
  $$select 1 from auth.refresh_tokens where user_id = tests.gb('coordinator')::text$$,
  'Deactiveren laat ook de refresh tokens vervallen'
);

select * from finish();
rollback;
