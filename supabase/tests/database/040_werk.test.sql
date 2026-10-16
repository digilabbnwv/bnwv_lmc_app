-- Werk: werkpakketten, scholen, activiteittypes, MATT-projecten en toewijzingen.
-- Beheer door coordinator en manager; MATT-projecten ook door de beheerder (SPEC §6).
begin;
create extension if not exists pgtap with schema extensions;
select * from no_plan();

select tests.maak_personas();

-- Testgegevens
insert into public.activiteittype (naam, normuren_uitvoering) values ('Testtype', 1), ('Wegtype', 1);
insert into public.werkpakket (soort, naam, vestiging) values
  ('school', 'Testschool', 'HAR'),
  ('school', 'Lege school', 'ERM'),
  ('school', 'Weg school', 'NUN'),
  ('project', 'Testproject', 'overig'),
  ('project', 'Weg project', 'overig');
insert into public.werkpakket (soort, naam, vestiging, activiteittype_id)
select 'activiteit', 'Testactiviteit', 'PUT', id from public.activiteittype where naam = 'Testtype';
insert into public.school (werkpakket_id, schooltype)
select id, 'PO' from public.werkpakket where naam in ('Testschool', 'Weg school');
insert into public.school_schooljaar (school_id, schooljaar_id, aantal_leerlingen)
select w.id, s.id, 250
from public.werkpakket w, public.schooljaar s
where w.naam = 'Testschool' and s.naam = '2026-2027';
insert into public.matt_project (projectnummer, naam_laatst_gezien) values ('778', 'Weg');

-- Toewijzingen voor lmc A en lmc B
insert into public.toewijzing
  (medewerker_id, werkpakket_id, schooljaar_id, bron, verdeling)
select tests.mw(p.naam), w.id, s.id, 'staffel', 'schoolweken'
from (values ('lmc_a'), ('lmc_b')) as p (naam), public.werkpakket w, public.schooljaar s
where w.naam = 'Testschool' and s.naam = '2026-2027';

insert into public.toewijzing
  (medewerker_id, werkpakket_id, schooljaar_id, bron, aantal_keer, verdeling)
select tests.mw(p.naam), w.id, s.id, 'norm_x_aantal', 4, 'op_datum'
from (values ('lmc_a'), ('lmc_b')) as p (naam), public.werkpakket w, public.schooljaar s
where w.naam = 'Testactiviteit' and s.naam = '2026-2027';

insert into public.toewijzing_datum (toewijzing_id, datum)
select t.id, d.datum::date
from public.toewijzing t
join public.werkpakket w on w.id = t.werkpakket_id and w.naam = 'Testactiviteit'
cross join (values ('2026-10-01'), ('2026-11-05')) as d (datum);

-- ---------------------------------------------------------------------------
-- Rechtenmatrix
-- ---------------------------------------------------------------------------

select * from tests.matrix(
  'public.activiteittype', tests.lees_alle(), null, '{coordinator,manager}',
  $$insert into public.activiteittype (naam) values ('Nieuw type')$$,
  $$update public.activiteittype set naam = naam where naam = 'Testtype'$$,
  $$delete from public.activiteittype where naam = 'Wegtype'$$
);

select * from tests.matrix(
  'public.werkpakket', tests.lees_alle(), null, '{coordinator,manager}',
  $$insert into public.werkpakket (soort, naam, vestiging) values ('project', 'Nieuw', 'ELS')$$,
  $$update public.werkpakket set naam = naam where naam = 'Testproject'$$,
  $$delete from public.werkpakket where naam = 'Weg project'$$
);

select * from tests.matrix(
  'public.school', tests.lees_alle(), null, '{coordinator,manager}',
  $$insert into public.school (werkpakket_id, schooltype)
    select id, 'VO' from public.werkpakket where naam = 'Lege school'$$,
  $$update public.school set schooltype = schooltype
    where werkpakket_id = (select id from public.werkpakket where naam = 'Testschool')$$,
  $$delete from public.school
    where werkpakket_id = (select id from public.werkpakket where naam = 'Weg school')$$
);

select * from tests.matrix(
  'public.school_schooljaar', tests.lees_alle(), null, '{coordinator,manager}',
  $$insert into public.school_schooljaar (school_id, schooljaar_id, aantal_leerlingen)
    select w.id, s.id, 300 from public.werkpakket w, public.schooljaar s
    where w.naam = 'Testschool' and s.naam = '2025-2026'$$,
  $$update public.school_schooljaar set aantal_leerlingen = aantal_leerlingen
    where school_id = (select id from public.werkpakket where naam = 'Testschool')$$,
  $$delete from public.school_schooljaar
    where school_id = (select id from public.werkpakket where naam = 'Testschool')$$
);

select * from tests.matrix(
  'public.matt_project', tests.lees_alle(), null, '{coordinator,manager,beheerder}',
  $$insert into public.matt_project (projectnummer) values ('777')$$,
  $$update public.matt_project set genegeerd = genegeerd where projectnummer = '901'$$,
  $$delete from public.matt_project where projectnummer = '778'$$
);

select * from tests.matrix(
  'public.toewijzing', tests.lees_eigen_of_cmb(), 'medewerker_id = $mw', '{coordinator,manager}',
  $$insert into public.toewijzing (
      medewerker_id, werkpakket_id, schooljaar_id, bron,
      gepland_uitvoering, gepland_voorbereiding, gepland_afronding, verdeling, looptijd_van, looptijd_tot)
    select tests.mw('lmc_b'), w.id, s.id, 'handmatig', 10, 5, 1, 'looptijd', '2026-09-01', '2026-10-31'
    from public.werkpakket w, public.schooljaar s
    where w.naam = 'Testproject' and s.naam = '2026-2027'$$,
  $$update public.toewijzing set toelichting = toelichting where medewerker_id = tests.mw('lmc_b')$$,
  $$delete from public.toewijzing where medewerker_id = tests.mw('lmc_b')$$
);

select * from tests.matrix(
  'public.toewijzing_datum', tests.lees_eigen_of_cmb(),
  'toewijzing_id in (select id from public.toewijzing where medewerker_id = $mw)',
  '{coordinator,manager}',
  $$insert into public.toewijzing_datum (toewijzing_id, datum)
    select id, '2026-12-03' from public.toewijzing
    where medewerker_id = tests.mw('lmc_b') and verdeling = 'op_datum'$$,
  $$update public.toewijzing_datum set datum = datum
    where toewijzing_id in (select id from public.toewijzing where medewerker_id = tests.mw('lmc_b'))$$,
  $$delete from public.toewijzing_datum
    where toewijzing_id in (select id from public.toewijzing where medewerker_id = tests.mw('lmc_b'))$$
);

select matches(
  tests.aantal('lmc_a', $$select * from public.toewijzing where medewerker_id = tests.mw('lmc_b')$$),
  '^rijen:0$', 'lmc A ziet de toewijzingen van B niet via het ID van B'
);

select matches(
  tests.aantal('lmc_a', $$select * from public.toewijzing where medewerker_id = tests.mw('lmc_a')$$),
  '^rijen:2$', 'lmc A ziet zijn eigen toewijzingen'
);

-- ---------------------------------------------------------------------------
-- Constraints
-- ---------------------------------------------------------------------------

select throws_ok(
  $$insert into public.werkpakket (soort, naam, vestiging) values ('activiteit', 'Zonder type', 'HAR')$$,
  '23514', null, 'Een activiteit vraagt een activiteittype'
);

select throws_ok(
  $$insert into public.werkpakket (soort, naam, vestiging, activiteittype_id)
    select 'project', 'Met type', 'HAR', id from public.activiteittype where naam = 'Testtype'$$,
  '23514', null, 'Alleen een activiteit heeft een activiteittype'
);

select throws_ok(
  $$insert into public.school (werkpakket_id, schooltype)
    select id, 'PO' from public.werkpakket where naam = 'Testproject'$$,
  '23503', null, 'Een school hoort bij een werkpakket met soort school'
);

select matches(
  tests.probeer('eigenaar', $$update public.werkpakket set soort = 'project' where naam = 'Testschool'$$),
  '^fout:(23503|23001) ',
  'Een werkpakket met schoolgegevens kan niet van soort veranderen'
);

select throws_ok(
  $$update public.school_schooljaar set uren_handmatig = 80
    where school_id = (select id from public.werkpakket where naam = 'Testschool')$$,
  '23514', null, 'Handmatige staffeluren vragen een toelichting'
);

select lives_ok(
  $$update public.school_schooljaar set uren_handmatig = 80, toelichting = 'Extra inzet afgesproken'
    where school_id = (select id from public.werkpakket where naam = 'Testschool')$$,
  'Handmatige staffeluren met toelichting zijn toegestaan'
);

select throws_ok(
  $$insert into public.school (werkpakket_id, schooltype, postcode)
    select id, 'PO', 'ABCD 12' from public.werkpakket where naam = 'Lege school'$$,
  '23514', null, 'Postcode heeft de Nederlandse vorm'
);

select throws_ok(
  $$insert into public.toewijzing (medewerker_id, werkpakket_id, schooljaar_id, bron, verdeling)
    select tests.mw('coordinator'), w.id, s.id, 'staffel', 'schoolweken'
    from public.werkpakket w, public.schooljaar s
    where w.naam = 'Testproject' and s.naam = '2026-2027'$$,
  '23514', null, 'Bron staffel kan alleen bij een school'
);

select throws_ok(
  $$insert into public.toewijzing (medewerker_id, werkpakket_id, schooljaar_id, bron, aantal_keer, verdeling)
    select tests.mw('coordinator'), w.id, s.id, 'norm_x_aantal', 3, 'schoolweken'
    from public.werkpakket w, public.schooljaar s
    where w.naam = 'Testschool' and s.naam = '2026-2027'$$,
  '23514', null, 'Bron norm_x_aantal kan alleen bij een activiteit'
);

select throws_ok(
  $$insert into public.toewijzing (medewerker_id, werkpakket_id, schooljaar_id, bron, verdeling)
    select tests.mw('coordinator'), w.id, s.id, 'norm_x_aantal', 'schoolweken'
    from public.werkpakket w, public.schooljaar s
    where w.naam = 'Testactiviteit' and s.naam = '2026-2027'$$,
  '23514', null, 'Bron norm_x_aantal vraagt aantal_keer'
);

select throws_ok(
  $$insert into public.toewijzing (medewerker_id, werkpakket_id, schooljaar_id, bron, verdeling)
    select tests.mw('coordinator'), w.id, s.id, 'handmatig', 'schoolweken'
    from public.werkpakket w, public.schooljaar s
    where w.naam = 'Testproject' and s.naam = '2026-2027'$$,
  '23514', null, 'Bron handmatig vraagt geplande uren'
);

select throws_ok(
  $$insert into public.toewijzing (medewerker_id, werkpakket_id, schooljaar_id, bron,
      gepland_uitvoering, gepland_voorbereiding, gepland_afronding, verdeling)
    select tests.mw('coordinator'), w.id, s.id, 'staffel', 1, 1, 1, 'schoolweken'
    from public.werkpakket w, public.schooljaar s
    where w.naam = 'Testschool' and s.naam = '2026-2027'$$,
  '23514', null, 'Bij bron staffel worden geen uren ingevoerd'
);

select throws_ok(
  $$insert into public.toewijzing (medewerker_id, werkpakket_id, schooljaar_id, bron,
      gepland_uitvoering, gepland_voorbereiding, gepland_afronding, aandeel_percentage, verdeling)
    select tests.mw('coordinator'), w.id, s.id, 'handmatig', 1, 1, 1, 50, 'schoolweken'
    from public.werkpakket w, public.schooljaar s
    where w.naam = 'Testproject' and s.naam = '2026-2027'$$,
  '23514', null, 'Aandeelpercentage geldt alleen bij bron staffel'
);

select lives_ok(
  $$insert into public.toewijzing (medewerker_id, werkpakket_id, schooljaar_id, bron, aandeel_percentage, verdeling)
    select tests.mw('coordinator'), w.id, s.id, 'staffel', 50, 'schoolweken'
    from public.werkpakket w, public.schooljaar s
    where w.naam = 'Testschool' and s.naam = '2026-2027'$$,
  'Gedeelde school met aandeelpercentage is toegestaan'
);

select throws_ok(
  $$insert into public.toewijzing (medewerker_id, werkpakket_id, schooljaar_id, bron,
      gepland_uitvoering, gepland_voorbereiding, gepland_afronding, verdeling, looptijd_van, looptijd_tot)
    select tests.mw('coordinator'), w.id, s.id, 'handmatig', 1, 1, 1, 'looptijd', '2026-07-01', '2026-09-30'
    from public.werkpakket w, public.schooljaar s
    where w.naam = 'Testproject' and s.naam = '2026-2027'$$,
  '23514', null, 'De looptijd valt binnen het schooljaar'
);

select throws_ok(
  $$insert into public.toewijzing (medewerker_id, werkpakket_id, schooljaar_id, bron,
      gepland_uitvoering, gepland_voorbereiding, gepland_afronding, verdeling)
    select tests.mw('coordinator'), w.id, s.id, 'handmatig', 1, 1, 1, 'looptijd'
    from public.werkpakket w, public.schooljaar s
    where w.naam = 'Testproject' and s.naam = '2026-2027'$$,
  '23514', null, 'Verdeling looptijd vraagt een van- en totdatum'
);

select throws_ok(
  $$insert into public.toewijzing (medewerker_id, werkpakket_id, schooljaar_id, bron, verdeling)
    select tests.mw('lmc_a'), w.id, s.id, 'staffel', 'schoolweken'
    from public.werkpakket w, public.schooljaar s
    where w.naam = 'Testschool' and s.naam = '2026-2027'$$,
  '23505', null, 'Eén toewijzing per medewerker, werkpakket en schooljaar'
);

select throws_ok(
  $$insert into public.toewijzing_datum (toewijzing_id, datum)
    select t.id, '2026-10-01' from public.toewijzing t
    join public.werkpakket w on w.id = t.werkpakket_id
    where w.naam = 'Testschool' and t.medewerker_id = tests.mw('lmc_a')$$,
  '23514', null, 'Datums horen alleen bij een toewijzing met verdeling op_datum'
);

select throws_ok(
  $$insert into public.toewijzing_datum (toewijzing_id, datum)
    select id, '2027-08-15' from public.toewijzing
    where medewerker_id = tests.mw('lmc_a') and verdeling = 'op_datum'$$,
  '23514', null, 'Datums liggen binnen het schooljaar van de toewijzing'
);

select matches(
  tests.probeer('eigenaar', $$delete from public.medewerker where email = 'kees.vandijk@voorbeeld.test'$$),
  '^fout:(23503|23001) ',
  'Een medewerker met toewijzingen kan niet worden verwijderd (deactiveren)'
);

select is(
  (select count(*)::int from public.matt_project where werkpakket_id is not null),
  13,
  'Seed koppelt de 13 bekende MATT-projecten uit de fixture'
);

select is_empty(
  $$select 1 from public.matt_project where projectnummer = '999'$$,
  'Projectnummer 999 uit de fixture staat bewust niet in de seed'
);

select * from finish();
rollback;
