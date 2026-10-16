-- MATT-import (SPEC §8): concept, definitief, terugdraaien, verwerpen en gerealiseerd.
begin;
create extension if not exists pgtap with schema extensions;
select * from no_plan();

select tests.maak_personas();
insert into public.medewerker_alias (medewerker_id, bron, alias) values
  (tests.mw('lmc_a'), 'matt', 'Test Persoon A'),
  (tests.mw('lmc_b'), 'matt', 'Test Persoon B');

-- Regels zoals de Edge Function ze aanlevert (MATT vult namen op met spaties).
create function pg_temp.regels(p_extra text default '') returns jsonb language sql as $$
  select jsonb_build_array(
    jsonb_build_object('medewerker', 'Test Persoon A' || repeat(' ', 50), 'projectnummer', '901',
      'projectnaam', 'Zonnebloem-HAR', 'artikelcode', '10', 'datum', '2026-02-02',
      'uren', 2.5, 'uren_open', 0, 'omschrijving', 'Voorlezen'),
    jsonb_build_object('medewerker', 'test   persoon a', 'projectnummer', '901',
      'projectnaam', 'Zonnebloem-HAR', 'artikelcode', '11', 'datum', '2026-02-07',
      'uren', 1, 'uren_open', 0.5, 'omschrijving', 'Voorbereiden (zaterdag)'),
    jsonb_build_object('medewerker', 'Test Persoon B', 'projectnummer', '777',
      'projectnaam', 'Nieuw project' || p_extra, 'artikelcode', '12', 'datum', '2026-02-10',
      'uren', 3, 'uren_open', 0, 'omschrijving', 'Overleg'),
    jsonb_build_object('medewerker', 'Testpersoon Onbekend', 'projectnummer', '901',
      'projectnaam', 'Zonnebloem-HAR', 'artikelcode', '10', 'datum', '2026-02-11',
      'uren', 4, 'uren_open', 0, 'omschrijving', 'Iets'),
    jsonb_build_object('medewerker', 'Test Persoon B', 'projectnummer', '901',
      'projectnaam', 'Zonnebloem-HAR', 'artikelcode', '99', 'datum', '2026-02-12',
      'uren', 1, 'uren_open', 0, 'omschrijving', '')
  )
$$;
grant execute on function pg_temp.regels(text) to authenticated, anon;

-- ---------------------------------------------------------------------------
-- Rechten
-- ---------------------------------------------------------------------------

select is(tests.waarde('coordinator', 'select public.mag_matt_importeren()'), 'true', 'Coordinator mag importeren');
select is(tests.waarde('manager', 'select public.mag_matt_importeren()'), 'true', 'Manager mag importeren');
select is(tests.waarde('beheerder', 'select public.mag_matt_importeren()'), 'true', 'Beheerder mag importeren');
select is(tests.waarde('lmc_a', 'select public.mag_matt_importeren()'), 'false', 'lmc mag niet importeren');
select is(tests.waarde('manager_aal1', 'select public.mag_matt_importeren()'), 'false', 'Op aal1 mag niemand importeren');

select is(
  tests.probeer('lmc_a', $$select public.matt_import_concept_opslaan('2026-02-01', '2026-02-28', pg_temp.regels())$$),
  'geweigerd', 'lmc kan geen concept opslaan'
);
select is(
  tests.probeer('manager_aal1', $$select public.matt_import_concept_opslaan('2026-02-01', '2026-02-28', pg_temp.regels())$$),
  'geweigerd', 'Op aal1 kan niemand een concept opslaan'
);
select is(
  tests.probeer('anon', $$select public.matt_import_concept_opslaan('2026-02-01', '2026-02-28', pg_temp.regels())$$),
  'geweigerd', 'anon kan geen concept opslaan'
);

-- ---------------------------------------------------------------------------
-- Concept
-- ---------------------------------------------------------------------------

select matches(
  tests.probeer('coordinator', $$select public.matt_import_concept_opslaan('2026-02-15', '2026-02-28', pg_temp.regels())$$),
  '^fout:22023', 'Boekingen buiten de periode worden geweigerd'
);

create temporary table voorvertoning (v jsonb);
grant all on voorvertoning to authenticated;
do $$
begin
  perform tests.wissel('coordinator');
  insert into pg_temp.voorvertoning
  select public.matt_import_concept_opslaan('2026-02-01', '2026-02-28', pg_temp.regels());
end
$$;
reset role;

select is((select (v -> 'totaal' ->> 'aantal')::int from voorvertoning), 5, 'Voorvertoning: 5 regels in totaal');
select is((select (v -> 'opgeslagen' ->> 'aantal')::int from voorvertoning), 4, 'Voorvertoning: 4 regels van gematchte medewerkers');
select is((select (v ->> 'niet_gematcht_aantal')::int from voorvertoning), 1, 'Voorvertoning: 1 regel niet gematcht');
select is(
  (select jsonb_array_length(v -> 'medewerkers') from voorvertoning), 2,
  'Voorvertoning: 2 gematchte medewerkers (naam genormaliseerd: spaties en hoofdletters)'
);
select is(
  (select v -> 'niet_gekoppelde_projecten' -> 0 ->> 'projectnummer' from voorvertoning), '777',
  'Voorvertoning: het onbekende project 777'
);
select is(
  (select v -> 'onbekende_artikelcodes' -> 0 ->> 'artikelcode' from voorvertoning), '99',
  'Voorvertoning: de onbekende artikelcode 99'
);

select is(
  (select count(*)::int from public.boeking b join public.matt_import i on i.id = b.import_id
   where i.id = (select (v ->> 'import_id')::uuid from voorvertoning)),
  4, 'Alleen boekingen van gematchte medewerkers zijn opgeslagen'
);
select is_empty(
  $$select 1 from public.boeking b where b.medewerker_id not in (tests.mw('lmc_a'), tests.mw('lmc_b'))
    and b.import_id = (select (v ->> 'import_id')::uuid from voorvertoning)$$,
  'Er is geen boeking van de niet-gematchte persoon'
);
select results_eq(
  $$select naam, aantal, uren from public.matt_import_niet_gematcht
    where import_id = (select (v ->> 'import_id')::uuid from voorvertoning)$$,
  $$values ('Testpersoon Onbekend'::text, 1, 4::numeric)$$,
  'De niet-gematchte naam staat in de voorvertoning-tabel'
);
select ok(
  exists (select 1 from public.matt_project where projectnummer = '777' and werkpakket_id is null),
  'Onbekend projectnummer is aangemaakt als niet gekoppeld'
);
select is(
  (select categorie::text from public.boeking where artikelcode = '99'
     and import_id = (select (v ->> 'import_id')::uuid from voorvertoning)),
  null, 'Onbekende artikelcode: boeking opgeslagen zonder categorie'
);
select is(
  (select count(*)::int from public.boeking_omschrijving o join public.boeking b on b.id = o.boeking_id
   where b.import_id = (select (v ->> 'import_id')::uuid from voorvertoning)),
  3, 'Omschrijvingen opgeslagen (lege omschrijving niet)'
);
select is(
  (select count(*)::int from public.gerealiseerd g
   where g.boeking_id in (select id from public.boeking where import_id = (select (v ->> 'import_id')::uuid from voorvertoning))),
  0, 'Een concept telt niet mee in gerealiseerd'
);
select is_empty(
  $$select 1 from public.auditlog where nieuwe_waarde::text like '%Testpersoon Onbekend%'
    or oude_waarde::text like '%Testpersoon Onbekend%'$$,
  'Niet-gematchte namen komen niet in het auditlog'
);
select is_empty(
  $$select 1 from public.matt_import where aantallen::text like '%Testpersoon%'$$,
  'De aantallen van de import bevatten geen namen'
);

-- ---------------------------------------------------------------------------
-- Definitief maken
-- ---------------------------------------------------------------------------

select is(
  tests.probeer('lmc_a', $$select public.matt_import_definitief_maken((select (v ->> 'import_id')::uuid from pg_temp.voorvertoning))$$),
  'geweigerd', 'lmc kan niet definitief maken'
);

do $$
begin
  perform tests.wissel('coordinator');
  perform public.matt_import_definitief_maken((select (v ->> 'import_id')::uuid from pg_temp.voorvertoning));
end
$$;
reset role;

select is(
  (select status::text from public.matt_import where id = (select (v ->> 'import_id')::uuid from voorvertoning)),
  'definitief', 'De import is definitief'
);
select is_empty(
  $$select 1 from public.matt_import_niet_gematcht where import_id = (select (v ->> 'import_id')::uuid from voorvertoning)$$,
  'Na definitief maken zijn de niet-gematchte namen weg'
);
select is(
  (select round(sum(uren), 2) from public.gerealiseerd
   where medewerker_id in (tests.mw('lmc_a'), tests.mw('lmc_b')) and datum between '2026-02-01' and '2026-02-28'),
  7.50, 'Gerealiseerd: 2,5 + 1 + 3 + 1 uur (weekendboeking telt mee)'
);
select ok(
  exists (select 1 from public.auditlog where actie = 'matt_import_definitief'
    and gebruiker_id = tests.gb('coordinator')),
  'Definitief maken staat in het auditlog'
);
select matches(
  tests.probeer('coordinator', $$select public.matt_import_definitief_maken((select (v ->> 'import_id')::uuid from pg_temp.voorvertoning))$$),
  '^fout:22023', 'Een definitieve import kan niet nog eens definitief worden gemaakt'
);

-- Tweede import van dezelfde regels: geen duplicaten.
truncate voorvertoning;
do $$
begin
  perform tests.wissel('manager');
  insert into pg_temp.voorvertoning
  select public.matt_import_concept_opslaan('2026-02-01', '2026-02-28', pg_temp.regels());
  perform public.matt_import_definitief_maken((select (v ->> 'import_id')::uuid from pg_temp.voorvertoning));
end
$$;
reset role;

select is(
  (select count(*)::int from public.gerealiseerd
   where medewerker_id in (tests.mw('lmc_a'), tests.mw('lmc_b')) and datum between '2026-02-01' and '2026-02-28'),
  4, 'Na een tweede import van hetzelfde bestand: geen dubbele boekingen'
);
select is(
  (select round(sum(uren), 2) from public.gerealiseerd
   where medewerker_id in (tests.mw('lmc_a'), tests.mw('lmc_b')) and datum between '2026-02-01' and '2026-02-28'),
  7.50, 'Na een tweede import: dezelfde uren'
);

-- ---------------------------------------------------------------------------
-- Gerealiseerd: genegeerde projecten en RLS
-- ---------------------------------------------------------------------------

update public.matt_project set genegeerd = true where projectnummer = '777';
select is(
  (select round(sum(uren), 2) from public.gerealiseerd
   where medewerker_id in (tests.mw('lmc_a'), tests.mw('lmc_b')) and datum between '2026-02-01' and '2026-02-28'),
  4.50, 'Een genegeerd project telt niet mee'
);
update public.matt_project set genegeerd = false where projectnummer = '777';

select matches(
  tests.aantal('lmc_a', $$select * from public.gerealiseerd$$),
  '^rijen:2$', 'lmc A ziet in gerealiseerd alleen de eigen boekingen'
);
select matches(
  tests.aantal('lmc_a', $$select * from public.gerealiseerd where medewerker_id = tests.mw('lmc_b')$$),
  '^rijen:0$', 'lmc A ziet de gerealiseerde uren van B niet'
);
select matches(
  tests.aantal('lmc_a_aal1', $$select * from public.gerealiseerd$$),
  '^rijen:0$', 'Op aal1 is gerealiseerd leeg'
);
select matches(
  tests.aantal('lmc_a', $$select * from public.matt_import$$),
  '^rijen:0$', 'lmc ziet de imports zelf niet'
);
select matches(
  tests.aantal('lmc_a', $$select * from public.matt_import_niet_gematcht$$),
  '^rijen:0$', 'lmc ziet de niet-gematchte namen niet'
);

-- ---------------------------------------------------------------------------
-- Terugdraaien en verwerpen
-- ---------------------------------------------------------------------------

select is(
  tests.probeer('lmc_a', $$select public.matt_import_terugdraaien((select (v ->> 'import_id')::uuid from pg_temp.voorvertoning))$$),
  'geweigerd', 'lmc kan niet terugdraaien'
);
do $$
begin
  perform tests.wissel('beheerder');
  perform public.matt_import_terugdraaien((select (v ->> 'import_id')::uuid from pg_temp.voorvertoning));
end
$$;
reset role;

select is(
  (select status::text from public.matt_import where id = (select (v ->> 'import_id')::uuid from voorvertoning)),
  'teruggedraaid', 'De import is teruggedraaid'
);
select is_empty(
  $$select 1 from public.boeking where import_id = (select (v ->> 'import_id')::uuid from voorvertoning)$$,
  'Teruggedraaide boekingen zijn verwijderd'
);
select is(
  (select count(*)::int from public.gerealiseerd
   where medewerker_id in (tests.mw('lmc_a'), tests.mw('lmc_b')) and datum between '2026-02-01' and '2026-02-28'),
  0, 'Teruggedraaide boekingen tellen niet meer mee'
);
select ok(
  exists (select 1 from public.auditlog where actie = 'matt_import_teruggedraaid'),
  'Terugdraaien staat in het auditlog'
);

truncate voorvertoning;
do $$
begin
  perform tests.wissel('coordinator');
  insert into pg_temp.voorvertoning
  select public.matt_import_concept_opslaan('2026-02-01', '2026-02-28', pg_temp.regels());
end
$$;
reset role;
select matches(
  tests.probeer('coordinator', $$select public.matt_import_terugdraaien((select (v ->> 'import_id')::uuid from pg_temp.voorvertoning))$$),
  '^fout:22023', 'Een concept kan niet worden teruggedraaid'
);
do $$
begin
  perform tests.wissel('coordinator');
  perform public.matt_import_verwerpen((select (v ->> 'import_id')::uuid from pg_temp.voorvertoning));
end
$$;
reset role;
select is_empty(
  $$select 1 from public.matt_import where id = (select (v ->> 'import_id')::uuid from voorvertoning)$$,
  'Een verworpen concept is helemaal weg (met boekingen en namen)'
);

select * from finish();
rollback;
