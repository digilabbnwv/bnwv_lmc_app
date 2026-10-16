-- Kern: medewerker, gebruiker_rol, profiel, auditlog en de RLS-hulpfuncties (SPEC §6, §7).
begin;
create extension if not exists pgtap with schema extensions;
select * from no_plan();

select tests.maak_personas();

-- Extra medewerker zonder afhankelijkheden, om te verwijderen.
insert into public.medewerker (voornaam, achternaam, email)
values ('Weg', 'Medewerker', 'weg@voorbeeld.test');

-- ---------------------------------------------------------------------------
-- Rechtenmatrix
-- ---------------------------------------------------------------------------

select * from tests.matrix(
  'public.medewerker',
  tests.lees_eigen_of_cmb(),
  'id = $mw',
  '{coordinator,manager,beheerder}',
  $$insert into public.medewerker (voornaam, achternaam, email)
    values ('Nieuw', 'Persoon', 'nieuw@voorbeeld.test')$$,
  $$update public.medewerker set voornaam = voornaam where id = tests.mw('lmc_b')$$,
  $$delete from public.medewerker where email = 'weg@voorbeeld.test'$$
);

-- gebruiker_rol: schrijven op een ander dan zichzelf, met een niet-beheerdersrol.
select * from tests.matrix(
  'public.gebruiker_rol',
  '{"lmc_a":"eigen","lmc_b":"eigen","coordinator":"eigen","manager":"alles","beheerder":"alles"}',
  'gebruiker_id = $gb',
  '{manager,beheerder}',
  $$insert into public.gebruiker_rol (gebruiker_id, rol) values (tests.gb('lmc_b'), 'coordinator')$$,
  $$update public.gebruiker_rol set rol = rol where gebruiker_id = tests.gb('lmc_b')$$,
  $$delete from public.gebruiker_rol where gebruiker_id = tests.gb('lmc_b')$$
);

-- profiel: koppeling van een ander wijzigen.
insert into public.medewerker (voornaam, achternaam, email)
values ('Vrij', 'Medewerker', 'vrij@voorbeeld.test');
insert into auth.users (id, email, aud, role)
values ('00000000-0000-4000-8000-000000000001', 'nieuw-account@voorbeeld.test', 'authenticated', 'authenticated');

select * from tests.matrix(
  'public.profiel',
  '{"lmc_a":"eigen","lmc_b":"eigen","coordinator":"eigen","manager":"alles","beheerder":"alles"}',
  'gebruiker_id = $gb',
  '{manager,beheerder}',
  $$insert into public.profiel (gebruiker_id, medewerker_id)
    select '00000000-0000-4000-8000-000000000001', id from public.medewerker
    where email = 'vrij@voorbeeld.test'$$,
  $$update public.profiel set medewerker_id = medewerker_id where gebruiker_id = tests.gb('lmc_b')$$,
  $$delete from public.profiel where gebruiker_id = tests.gb('lmc_b')$$
);

select * from tests.matrix(
  'public.auditlog',
  '{"manager":"alles","beheerder":"alles"}',
  null,
  '{}',
  $$insert into public.auditlog (actie) values ('vervalst')$$,
  $$update public.auditlog set actie = 'vervalst'$$,
  $$delete from public.auditlog$$
);

-- ---------------------------------------------------------------------------
-- Rollen: geen escalatie
-- ---------------------------------------------------------------------------

select matches(
  tests.probeer('manager', $$insert into public.gebruiker_rol (gebruiker_id, rol)
    values (tests.gb('manager'), 'coordinator')$$),
  '^geweigerd$',
  'Manager kan zichzelf geen rol toekennen'
);

select matches(
  tests.probeer('beheerder', $$insert into public.gebruiker_rol (gebruiker_id, rol)
    values (tests.gb('beheerder'), 'manager')$$),
  '^geweigerd$',
  'Beheerder kan zichzelf geen rol toekennen'
);

select matches(
  tests.probeer('manager', $$delete from public.gebruiker_rol where gebruiker_id = tests.gb('manager')$$),
  '^rijen:0$',
  'Manager kan zijn eigen rol niet afnemen'
);

select matches(
  tests.probeer('manager', $$insert into public.gebruiker_rol (gebruiker_id, rol)
    values (tests.gb('lmc_b'), 'beheerder')$$),
  '^geweigerd$',
  'Manager kan de rol beheerder niet toekennen'
);

select matches(
  tests.probeer('manager', $$update public.gebruiker_rol set rol = 'beheerder'
    where gebruiker_id = tests.gb('lmc_b')$$),
  '^geweigerd$',
  'Manager kan een rol niet wijzigen in beheerder'
);

select matches(
  tests.probeer('manager', $$delete from public.gebruiker_rol where gebruiker_id = tests.gb('beheerder')$$),
  '^rijen:0$',
  'Manager kan de rol beheerder niet afnemen'
);

select matches(
  tests.probeer('beheerder', $$insert into public.gebruiker_rol (gebruiker_id, rol)
    values (tests.gb('lmc_b'), 'beheerder')$$),
  '^rijen:1$',
  'Beheerder kan de rol beheerder toekennen aan een ander'
);

select matches(
  tests.probeer('coordinator', $$insert into public.gebruiker_rol (gebruiker_id, rol)
    values (tests.gb('lmc_b'), 'coordinator')$$),
  '^geweigerd$',
  'Coordinator kan geen rollen toekennen'
);

-- ---------------------------------------------------------------------------
-- Profiel: geen eigen koppeling, wachtwoordvlag niet door gebruikers te wijzigen
-- ---------------------------------------------------------------------------

select matches(
  tests.probeer('manager', $$update public.profiel set medewerker_id = tests.mw('lmc_b')
    where gebruiker_id = tests.gb('manager')$$),
  '^(geweigerd|rijen:0)$',
  'Manager kan zijn eigen profiel niet aan een andere medewerker koppelen'
);

select matches(
  tests.probeer('manager', $$update public.profiel set moet_wachtwoord_wijzigen = false
    where gebruiker_id = tests.gb('moet_wijzigen')$$),
  '^geweigerd$',
  'Manager kan moet_wachtwoord_wijzigen niet wijzigen'
);

select matches(
  tests.probeer('manager', $$insert into public.profiel (gebruiker_id, medewerker_id, moet_wachtwoord_wijzigen)
    select '00000000-0000-4000-8000-000000000001', id, false from public.medewerker
    where email = 'vrij@voorbeeld.test'$$),
  '^geweigerd$',
  'Manager kan bij aanmaken moet_wachtwoord_wijzigen niet op false zetten'
);

select is(
  (select column_default from information_schema.columns
   where table_schema = 'public' and table_name = 'profiel'
     and column_name = 'moet_wachtwoord_wijzigen'),
  'true',
  'Standaardwaarde van moet_wachtwoord_wijzigen is true'
);

-- ---------------------------------------------------------------------------
-- Toegangsvoorwaarden
-- ---------------------------------------------------------------------------

select matches(
  tests.aantal('lmc_a', $$select * from public.medewerker where id = tests.mw('lmc_b')$$),
  '^rijen:0$',
  'lmc A kan medewerker B niet opvragen via het ID van B'
);

select matches(
  tests.aantal('lmc_a_aal1', $$select * from public.medewerker where id = tests.mw('lmc_a')$$),
  '^rijen:0$',
  'Op aal1 krijgt een gebruiker zelfs zijn eigen gegevens niet'
);

-- Deactiveren trekt de toegang direct in.
update public.medewerker set actief = false where id = tests.mw('coordinator');
select matches(
  tests.aantal('coordinator', 'select * from public.medewerker'),
  '^rijen:0$',
  'Na deactiveren ziet de coordinator niets meer'
);
update public.medewerker set actief = true where id = tests.mw('coordinator');

-- Rol afnemen trekt de toegang direct in.
delete from public.gebruiker_rol where gebruiker_id = tests.gb('lmc_b');
select matches(
  tests.aantal('lmc_b', $$select * from public.medewerker where id = tests.mw('lmc_b')$$),
  '^rijen:0$',
  'Zonder rol ziet een gebruiker niets, ook niet zichzelf'
);

-- ---------------------------------------------------------------------------
-- Auditlog: append-only en gevuld door triggers
-- ---------------------------------------------------------------------------

select matches(
  tests.probeer('coordinator', $$update public.medewerker set voornaam = 'Gewijzigd'
    where id = tests.mw('lmc_b')$$),
  '^rijen:1$',
  'Coordinator wijzigt een medewerker'
);

-- De wijziging is teruggedraaid door tests.probeer; voer hem nu echt uit als coordinator.
select tests.wissel('coordinator');
update public.medewerker set voornaam = 'Gewijzigd' where id = tests.mw('lmc_b');
reset role;

select ok(
  exists (
    select 1 from public.auditlog
    where tabel = 'medewerker' and actie = 'update'
      and record_id = tests.mw('lmc_b')::text
      and gebruiker_id = tests.gb('coordinator')
      and nieuwe_waarde ->> 'voornaam' = 'Gewijzigd'
      and oude_waarde ->> 'voornaam' = 'Test'
  ),
  'Wijziging staat in het auditlog met gebruiker, oude en nieuwe waarde'
);

select matches(
  tests.probeer('service_role', $$update public.auditlog set actie = 'vervalst'$$),
  '^geweigerd$',
  'Ook service_role kan het auditlog niet wijzigen'
);

select matches(
  tests.probeer('service_role', $$delete from public.auditlog$$),
  '^geweigerd$',
  'Ook service_role kan niets uit het auditlog verwijderen'
);

select throws_ok(
  $$update public.auditlog set actie = 'vervalst'$$,
  '42501',
  null,
  'Zelfs de eigenaar kan het auditlog niet wijzigen'
);

select throws_ok(
  $$delete from public.auditlog$$,
  '42501',
  null,
  'Zelfs de eigenaar kan niets uit het auditlog verwijderen'
);

select throws_ok(
  $$truncate public.auditlog$$,
  '42501',
  null,
  'Het auditlog kan niet worden geleegd'
);

select is_empty(
  $$
    select polname from pg_catalog.pg_policy
    where polrelid = 'public.auditlog'::regclass and polcmd in ('w', 'd', '*')
  $$,
  'Er bestaan geen update- of delete-policies op het auditlog'
);

select * from finish();
rollback;
