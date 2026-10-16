-- Medewerkergegevens: eigen gegevens of alles voor coordinator/manager/beheerder;
-- beheren door coordinator, manager en beheerder (SPEC §6).
begin;
create extension if not exists pgtap with schema extensions;
select * from no_plan();

select tests.maak_personas();

insert into public.contract (medewerker_id, uren_per_week, geldig_van, geldig_tot) values
  (tests.mw('lmc_a'), 24, '2026-08-01', null),
  (tests.mw('lmc_b'), 28, '2026-08-01', null);
insert into public.vakantie_uren (medewerker_id, kalenderjaar, uren) values
  (tests.mw('lmc_a'), 2027, 150),
  (tests.mw('lmc_b'), 2027, 160);
insert into public.niet_beschikbaar (medewerker_id, van, tot, beschikbaarheidspercentage) values
  (tests.mw('lmc_a'), '2027-03-01', '2027-03-12', 50),
  (tests.mw('lmc_b'), '2027-03-01', '2027-03-12', 50);
insert into public.medewerker_alias (medewerker_id, bron, alias) values
  (tests.mw('lmc_a'), 'matt', 'Test lmc_a'),
  (tests.mw('lmc_b'), 'matt', 'Test lmc_b');

-- ---------------------------------------------------------------------------
-- Rechtenmatrix
-- ---------------------------------------------------------------------------

select * from tests.matrix(
  'public.contract', tests.lees_eigen_of_cmb(), 'medewerker_id = $mw',
  '{coordinator,manager,beheerder}',
  $$insert into public.contract (medewerker_id, uren_per_week, geldig_van, geldig_tot)
    values (tests.mw('lmc_b'), 20, '2025-08-01', '2026-07-31')$$,
  $$update public.contract set uren_per_week = uren_per_week where medewerker_id = tests.mw('lmc_b')$$,
  $$delete from public.contract where medewerker_id = tests.mw('lmc_b')$$
);

select * from tests.matrix(
  'public.vakantie_uren', tests.lees_eigen_of_cmb(), 'medewerker_id = $mw',
  '{coordinator,manager,beheerder}',
  $$insert into public.vakantie_uren (medewerker_id, kalenderjaar, uren)
    values (tests.mw('lmc_b'), 2026, 150)$$,
  $$update public.vakantie_uren set uren = uren where medewerker_id = tests.mw('lmc_b')$$,
  $$delete from public.vakantie_uren where medewerker_id = tests.mw('lmc_b')$$
);

select * from tests.matrix(
  'public.niet_beschikbaar', tests.lees_eigen_of_cmb(), 'medewerker_id = $mw',
  '{coordinator,manager,beheerder}',
  $$insert into public.niet_beschikbaar (medewerker_id, van, tot, beschikbaarheidspercentage)
    values (tests.mw('lmc_b'), '2027-04-05', '2027-04-09', 0)$$,
  $$update public.niet_beschikbaar set beschikbaarheidspercentage = beschikbaarheidspercentage
    where medewerker_id = tests.mw('lmc_b')$$,
  $$delete from public.niet_beschikbaar where medewerker_id = tests.mw('lmc_b')$$
);

select * from tests.matrix(
  'public.medewerker_alias', tests.lees_cmb(), null, '{coordinator,manager,beheerder}',
  $$insert into public.medewerker_alias (medewerker_id, bron, alias)
    values (tests.mw('lmc_b'), 'planning', 'Test B')$$,
  $$update public.medewerker_alias set alias = alias where medewerker_id = tests.mw('lmc_b')$$,
  $$delete from public.medewerker_alias where medewerker_id = tests.mw('lmc_b')$$
);

-- lmc A kan gegevens van lmc B niet opvragen, ook niet via het ID van B.
select matches(
  tests.aantal('lmc_a', $$select * from public.contract where medewerker_id = tests.mw('lmc_b')$$),
  '^rijen:0$', 'lmc A ziet het contract van B niet via het ID van B'
);
select matches(
  tests.aantal('lmc_a', $$select * from public.vakantie_uren where medewerker_id = tests.mw('lmc_b')$$),
  '^rijen:0$', 'lmc A ziet de vakantie-uren van B niet via het ID van B'
);
select matches(
  tests.aantal('lmc_a', $$select * from public.niet_beschikbaar where medewerker_id = tests.mw('lmc_b')$$),
  '^rijen:0$', 'lmc A ziet de beschikbaarheid van B niet via het ID van B'
);
select matches(
  tests.aantal('lmc_a', $$select * from public.contract where medewerker_id = tests.mw('lmc_a')$$),
  '^rijen:1$', 'lmc A ziet zijn eigen contract wel'
);

-- ---------------------------------------------------------------------------
-- Constraints
-- ---------------------------------------------------------------------------

select throws_ok(
  $$insert into public.contract (medewerker_id, uren_per_week, geldig_van, geldig_tot)
    values (tests.mw('lmc_a'), 28, '2027-01-01', null)$$,
  '23P01', null, 'Contractperiodes van één medewerker mogen niet overlappen (doorlopend contract)'
);

select lives_ok(
  $$update public.contract set geldig_tot = '2026-12-31' where medewerker_id = tests.mw('lmc_a');
    insert into public.contract (medewerker_id, uren_per_week, geldig_van, geldig_tot)
    values (tests.mw('lmc_a'), 28, '2027-01-01', null)$$,
  'Aansluitende contracten zijn toegestaan (testcase B)'
);

select throws_ok(
  $$insert into public.contract (medewerker_id, uren_per_week, geldig_van, geldig_tot)
    values (tests.mw('lmc_a'), 20, '2026-12-31', '2026-12-31')$$,
  '23P01', null, 'Ook een overlap van één dag is niet toegestaan'
);

select lives_ok(
  $$insert into public.contract (medewerker_id, uren_per_week, geldig_van, geldig_tot)
    values (tests.mw('coordinator'), 20, '2026-08-01', null)$$,
  'Andere medewerkers mogen wel gelijktijdige contracten hebben'
);

select throws_ok(
  $$insert into public.niet_beschikbaar (medewerker_id, van, tot, beschikbaarheidspercentage)
    values (tests.mw('lmc_a'), '2027-03-10', '2027-03-20', 0)$$,
  '23P01', null, 'Periodes van verminderde beschikbaarheid mogen niet overlappen'
);

select throws_ok(
  $$insert into public.niet_beschikbaar (medewerker_id, van, tot, beschikbaarheidspercentage)
    values (tests.mw('lmc_a'), '2027-05-10', '2027-05-20', 101)$$,
  '23514', null, 'Beschikbaarheidspercentage ligt tussen 0 en 100'
);

select throws_ok(
  $$insert into public.vakantie_uren (medewerker_id, kalenderjaar, uren)
    values (tests.mw('lmc_a'), 2027, 10)$$,
  '23505', null, 'Per medewerker één regel vakantie-uren per kalenderjaar'
);

select is(
  (select array_agg(column_name::text order by ordinal_position)
   from information_schema.columns
   where table_schema = 'public' and table_name = 'niet_beschikbaar'),
  array['id', 'medewerker_id', 'van', 'tot', 'beschikbaarheidspercentage'],
  'niet_beschikbaar heeft geen veld voor een reden'
);

-- Alias-normalisatie: gelijk aan supabase/functions/_gedeeld/normaliseer.ts.
select is(
  private.normaliseer_naam('Sanne de Vries' || repeat(' ', 50)),
  'sanne de vries',
  'Normalisatie verwijdert opvulspaties uit MATT'
);
select is(
  private.normaliseer_naam(E'  Lotte   Visser -\t de Boer '),
  'lotte visser - de boer',
  'Normalisatie voegt spaties samen en maakt kleine letters'
);

select throws_ok(
  $$insert into public.medewerker_alias (medewerker_id, bron, alias)
    values (tests.mw('lmc_b'), 'matt', '  TEST   LMC_A  ')$$,
  '23505', null, 'Een genormaliseerde alias is uniek per bron'
);

select lives_ok(
  $$insert into public.medewerker_alias (medewerker_id, bron, alias)
    values (tests.mw('lmc_a'), 'planning', 'Test lmc_a')$$,
  'Dezelfde alias mag wel bij een andere bron'
);

select is(
  (select count(*)::int from public.medewerker_alias a
   join public.medewerker m on m.id = a.medewerker_id
   where a.bron = 'matt' and m.email like '%@voorbeeld.test' and m.voornaam <> 'Test'),
  5,
  'Seed bevat MATT-aliassen voor de vijf fictieve medewerkers uit de fixture'
);

select is_empty(
  $$select 1 from public.medewerker_alias
    where alias_genormaliseerd = private.normaliseer_naam('Testpersoon Onbekend')$$,
  'Testpersoon Onbekend uit de fixture heeft bewust geen alias'
);

select * from finish();
rollback;
