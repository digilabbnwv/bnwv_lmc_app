-- Configuratie: lezen voor iedereen met toegang, beheren door coordinator, manager
-- en beheerder (SPEC §6). Plus de constraints uit SPEC §4.
begin;
create extension if not exists pgtap with schema extensions;
select * from no_plan();

select tests.maak_personas();

-- Losse rijen zonder afhankelijkheden, om te wijzigen en te verwijderen.
insert into public.schooljaar (naam, startdatum, einddatum)
values ('2030-2031', '2030-08-01', '2031-07-31');
insert into public.schoolvakantie (schooljaar_id, naam, van, tot)
select id, 'Testvakantie', '2030-10-14', '2030-10-18' from public.schooljaar where naam = '2030-2031';
insert into public.feestdag (datum, naam) values ('2030-12-25', 'Testfeestdag');
insert into public.staffel (schooljaar_id, schooltype, leerlingen_min, leerlingen_max, uren)
select id, 'PO', 0, 100, 10 from public.schooljaar where naam = '2030-2031';
insert into public.opslagfactor (schooljaar_id, schooltype, factor)
select id, 'PO', 2.0 from public.schooljaar where naam = '2030-2031';
insert into public.instelling (sleutel, waarde, ingangsdatum)
values ('overhead_percentage', '20', '2030-08-01');
insert into public.matt_artikel_mapping (artikelcode, categorie) values ('99', 'uitvoering');

-- ---------------------------------------------------------------------------
-- Rechtenmatrix
-- ---------------------------------------------------------------------------

select * from tests.matrix(
  'public.schooljaar', tests.lees_alle(), null, '{coordinator,manager,beheerder}',
  $$insert into public.schooljaar (naam, startdatum, einddatum)
    values ('2031-2032', '2031-08-01', '2032-07-31')$$,
  $$update public.schooljaar set naam = naam where naam = '2030-2031'$$,
  $$delete from public.schooljaar where naam = '2030-2031'$$
);

select * from tests.matrix(
  'public.schoolvakantie', tests.lees_alle(), null, '{coordinator,manager,beheerder}',
  $$insert into public.schoolvakantie (schooljaar_id, naam, van, tot)
    select id, 'Nieuw', '2031-02-17', '2031-02-21' from public.schooljaar where naam = '2030-2031'$$,
  $$update public.schoolvakantie set naam = naam where naam = 'Testvakantie'$$,
  $$delete from public.schoolvakantie where naam = 'Testvakantie'$$
);

select * from tests.matrix(
  'public.feestdag', tests.lees_alle(), null, '{coordinator,manager,beheerder}',
  $$insert into public.feestdag (datum, naam) values ('2030-12-26', 'Nieuw')$$,
  $$update public.feestdag set naam = naam where datum = '2030-12-25'$$,
  $$delete from public.feestdag where datum = '2030-12-25'$$
);

select * from tests.matrix(
  'public.staffel', tests.lees_alle(), null, '{coordinator,manager,beheerder}',
  $$insert into public.staffel (schooljaar_id, schooltype, leerlingen_min, leerlingen_max, uren)
    select id, 'VO', 0, 100, 10 from public.schooljaar where naam = '2030-2031'$$,
  $$update public.staffel set uren = uren
    where schooljaar_id = (select id from public.schooljaar where naam = '2030-2031')$$,
  $$delete from public.staffel
    where schooljaar_id = (select id from public.schooljaar where naam = '2030-2031')$$
);

select * from tests.matrix(
  'public.opslagfactor', tests.lees_alle(), null, '{coordinator,manager,beheerder}',
  $$insert into public.opslagfactor (schooljaar_id, schooltype, factor)
    select id, 'VO', 2.0 from public.schooljaar where naam = '2030-2031'$$,
  $$update public.opslagfactor set factor = factor
    where schooljaar_id = (select id from public.schooljaar where naam = '2030-2031')$$,
  $$delete from public.opslagfactor
    where schooljaar_id = (select id from public.schooljaar where naam = '2030-2031')$$
);

select * from tests.matrix(
  'public.instelling', tests.lees_alle(), null, '{coordinator,manager,beheerder}',
  $$insert into public.instelling (sleutel, waarde, ingangsdatum)
    values ('grens_vol', '80', '2030-08-01')$$,
  $$update public.instelling set waarde = waarde where ingangsdatum = '2030-08-01'$$,
  $$delete from public.instelling where ingangsdatum = '2030-08-01'$$
);

select * from tests.matrix(
  'public.matt_artikel_mapping', tests.lees_alle(), null, '{coordinator,manager,beheerder}',
  $$insert into public.matt_artikel_mapping (artikelcode, categorie) values ('98', 'relatiebeheer')$$,
  $$update public.matt_artikel_mapping set categorie = categorie where artikelcode = '99'$$,
  $$delete from public.matt_artikel_mapping where artikelcode = '99'$$
);

-- ---------------------------------------------------------------------------
-- Constraints
-- ---------------------------------------------------------------------------

select throws_ok(
  $$insert into public.schooljaar (naam, startdatum, einddatum)
    values ('2030-2031b', '2031-01-01', '2031-12-31')$$,
  '23514', null, 'Schooljaarnaam moet de vorm JJJJ-JJJJ hebben'
);

select throws_ok(
  $$insert into public.schooljaar (naam, startdatum, einddatum)
    values ('2029-2031', '2031-01-01', '2031-12-31')$$,
  '23P01', null, 'Schooljaren mogen niet overlappen'
);

select throws_ok(
  $$insert into public.schoolvakantie (schooljaar_id, naam, van, tot)
    select id, 'Buiten', '2031-07-20', '2031-08-10' from public.schooljaar where naam = '2030-2031'$$,
  '23514', null, 'Een vakantie moet binnen het schooljaar vallen'
);

select throws_ok(
  $$insert into public.staffel (schooljaar_id, schooltype, leerlingen_min, leerlingen_max, uren)
    select id, 'PO', 50, 150, 10 from public.schooljaar where naam = '2030-2031'$$,
  '23P01', null, 'Staffelbereiken mogen niet overlappen'
);

select throws_ok(
  $$insert into public.staffel (schooljaar_id, schooltype, leerlingen_min, leerlingen_max, uren)
    select id, 'PO', 500, null, 10 from public.schooljaar where naam = '2030-2031';
    insert into public.staffel (schooljaar_id, schooltype, leerlingen_min, leerlingen_max, uren)
    select id, 'PO', 900, 1000, 10 from public.schooljaar where naam = '2030-2031'$$,
  '23P01', null, 'Een staffel zonder bovengrens overlapt met alles daarboven'
);

select lives_ok(
  $$insert into public.staffel (schooljaar_id, schooltype, leerlingen_min, leerlingen_max, uren)
    select id, 'PO', 101, 200, 20 from public.schooljaar where naam = '2030-2031'$$,
  'Aansluitende staffelbereiken zijn toegestaan'
);

select throws_ok(
  $$insert into public.instelling (sleutel, waarde, ingangsdatum)
    values ('onbekende_sleutel', '1', '2030-08-01')$$,
  '23514', null, 'Alleen bekende instellingen zijn toegestaan'
);

select throws_ok(
  $$insert into public.instelling (sleutel, waarde, ingangsdatum)
    values ('grens_vol', 'veel', '2031-08-01')$$,
  '23514', null, 'Een numerieke instelling moet een getal zijn'
);

select throws_ok(
  $$insert into public.instelling (sleutel, waarde, ingangsdatum)
    values ('toegestaan_email_domein', 'iets@kwaads', '2031-08-01')$$,
  '23514', null, 'Het e-maildomein moet een geldige domeinnaam zijn'
);

select throws_ok(
  $$insert into public.opslagfactor (schooljaar_id, schooltype, factor)
    select id, 'BoekStart', 0 from public.schooljaar where naam = '2030-2031'$$,
  '23514', null, 'Opslagfactor moet groter dan 0 zijn'
);

-- ---------------------------------------------------------------------------
-- Seed
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::int from public.feestdag
   where datum between '2026-08-01' and '2027-07-31'),
  7,
  'Seed bevat de 7 testfeestdagen van 2026-2027'
);

select is(
  (select count(*)::int from public.opslagfactor where factor = 2.0 and not bevestigd),
  (select count(*)::int from public.opslagfactor),
  'Alle opslagfactoren zijn 2,0 en nog niet bevestigd (seed + testrij)'
);

select * from finish();
rollback;
