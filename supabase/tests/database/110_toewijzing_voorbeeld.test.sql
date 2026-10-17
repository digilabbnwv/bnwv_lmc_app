-- Rekenvoorbeeld toewijzing (UI-4): dezelfde uitkomst als opslaan, maar er blijft niets achter.
begin;
create extension if not exists pgtap with schema extensions;
select * from no_plan();

select tests.maak_personas();

-- Testschool zoals testcase C: PO, staffel 50 uur, opslagfactor 2,0.
delete from public.staffel
where schooljaar_id = (select id from public.schooljaar where naam = '2026-2027') and schooltype = 'PO';
insert into public.staffel (schooljaar_id, schooltype, leerlingen_min, leerlingen_max, uren)
select id, 'PO', 0, null, 50 from public.schooljaar where naam = '2026-2027';
update public.opslagfactor set factor = 2.0
where schooljaar_id = (select id from public.schooljaar where naam = '2026-2027') and schooltype = 'PO';

insert into public.werkpakket (id, soort, naam, vestiging)
values ('00000000-0000-4000-8000-0000000001c1', 'school', 'Voorbeeldschool', 'HAR');
insert into public.school (werkpakket_id, schooltype) values ('00000000-0000-4000-8000-0000000001c1', 'PO');
insert into public.school_schooljaar (school_id, schooljaar_id, aantal_leerlingen)
select '00000000-0000-4000-8000-0000000001c1', id, 250 from public.schooljaar where naam = '2026-2027';

insert into public.werkpakket (id, soort, naam, vestiging)
values ('00000000-0000-4000-8000-0000000001d1', 'project', 'Voorbeeldproject', 'HAR');

-- Onafhankelijk geteld: werkdagen zonder feestdag en buiten de schoolvakanties.
create temporary table vb_schoolweekdagen as
select d::date as datum
from generate_series('2026-08-01'::date, '2027-07-31'::date, interval '1 day') d
where extract(isodow from d) < 6
  and not exists (select 1 from public.feestdag f where f.datum = d::date)
  and not exists (
    select 1 from public.schoolvakantie sv
    join public.schooljaar sj on sj.id = sv.schooljaar_id and sj.naam = '2026-2027'
    where d::date between sv.van and sv.tot
  );

-- Een bestaande toewijzing, om een wijziging te kunnen voorbeelden.
insert into public.toewijzing (id, medewerker_id, werkpakket_id, schooljaar_id, bron, verdeling)
select '00000000-0000-4000-8000-0000000001e1', tests.mw('lmc_b'),
  '00000000-0000-4000-8000-0000000001c1', id, 'staffel', 'schoolweken'
from public.schooljaar where naam = '2026-2027';

-- Nulmeting: na alle voorbeelden moeten deze aantallen gelijk zijn.
create temporary table vb_voor as
select (select count(*) from public.toewijzing) as toewijzingen,
       (select count(*) from public.toewijzing_datum) as datums,
       (select count(*) from public.auditlog) as audit;

-- Hulp: een voorbeeld als persona, als tekst "totaal|dagen|terugval".
create function pg_temp.vb(p_persona text, p_args text)
returns text
language sql
as $$
  select tests.waarde(
    p_persona,
    'select round(totaal, 4)::text || ''|'' || aantal_dagen || ''|'' || terugval
     from public.toewijzing_voorbeeld(' || p_args || ')'
  )
$$;

-- ---------------------------------------------------------------------------
-- Uitkomsten gelijk aan de planning
-- ---------------------------------------------------------------------------

select is(
  pg_temp.vb('coordinator', format(
    'null, %L, ''00000000-0000-4000-8000-0000000001c1'', (select id from public.schooljaar where naam = ''2026-2027''),
     ''staffel'', 100, null, null, null, null, ''schoolweken'', null, null, null',
    tests.mw('lmc_a'))),
  '100.0000|' || (select count(*) from vb_schoolweekdagen) || '|false',
  'Staffel 50 × factor 2,0 = 100 uur over alle schoolweekdagen (zoals testcase C)'
);

select is(
  pg_temp.vb('manager', format(
    'null, %L, ''00000000-0000-4000-8000-0000000001c1'', (select id from public.schooljaar where naam = ''2026-2027''),
     ''staffel'', 50, null, null, null, null, ''schoolweken'', null, null, null',
    tests.mw('lmc_a'))),
  '50.0000|' || (select count(*) from vb_schoolweekdagen) || '|false',
  'Aandeel 50% halveert de staffeluren'
);

select is(
  pg_temp.vb('coordinator', format(
    'null, %L, ''00000000-0000-4000-8000-0000000001d1'', (select id from public.schooljaar where naam = ''2026-2027''),
     ''handmatig'', null, null, 10, 6, 4, ''looptijd'', ''2027-03-01'', ''2027-03-12'', null',
    tests.mw('lmc_a'))),
  '20.0000|10|false',
  'Handmatig 10 + 6 + 4 uur over een looptijd van 10 werkdagen'
);

select is(
  pg_temp.vb('coordinator', format(
    'null, %L, ''00000000-0000-4000-8000-0000000001d1'', (select id from public.schooljaar where naam = ''2026-2027''),
     ''handmatig'', null, null, 3, 0, 0, ''op_datum'', null, null, ''{2027-02-01,2027-02-08,2027-02-08}''',
    tests.mw('lmc_a'))),
  '3.0000|2|false',
  'Op vaste datums: dubbele datums tellen één keer'
);

select is(
  pg_temp.vb('coordinator', format(
    'null, %L, ''00000000-0000-4000-8000-0000000001d1'', (select id from public.schooljaar where naam = ''2026-2027''),
     ''handmatig'', null, null, 3, 0, 0, ''op_datum'', null, null, ''{}''',
    tests.mw('lmc_a'))),
  '3.0000|0|true',
  'Zonder geschikte dagen: terugval op de eerste dag (geen uren verloren)'
);

-- Wijzigen van een bestaande toewijzing (vastgelegd vóór de nulmeting hierboven).

select is(
  pg_temp.vb('coordinator', format(
    '''00000000-0000-4000-8000-0000000001e1'', %L, ''00000000-0000-4000-8000-0000000001c1'',
     (select id from public.schooljaar where naam = ''2026-2027''),
     ''staffel'', 25, null, null, null, null, ''schoolweken'', null, null, null',
    tests.mw('lmc_b'))),
  '25.0000|' || (select count(*) from vb_schoolweekdagen) || '|false',
  'Voorbeeld van een wijziging rekent met de nieuwe waarden'
);
select is(
  (select aandeel_percentage from public.toewijzing where id = '00000000-0000-4000-8000-0000000001e1'),
  100::numeric,
  'De opgeslagen toewijzing is na het voorbeeld ongewijzigd'
);

-- ---------------------------------------------------------------------------
-- Er blijft niets achter
-- ---------------------------------------------------------------------------

select is(
  (select count(*) from public.toewijzing),
  (select toewijzingen from vb_voor),
  'Na de voorbeelden staan er geen extra toewijzingen'
);
select is(
  (select count(*) from public.toewijzing_datum),
  (select datums from vb_voor),
  'Na de voorbeelden staan er geen extra datums'
);
select is(
  (select count(*) from public.auditlog),
  (select audit from vb_voor),
  'De voorbeelden laten geen regels in het auditlog achter'
);

-- ---------------------------------------------------------------------------
-- Rechten en controles: zoals bij opslaan
-- ---------------------------------------------------------------------------

select is(
  pg_temp.vb(p, format(
    'null, %L, ''00000000-0000-4000-8000-0000000001c1'', (select id from public.schooljaar where naam = ''2026-2027''),
     ''staffel'', 100, null, null, null, null, ''schoolweken'', null, null, null',
    tests.mw('lmc_a'))),
  'geweigerd',
  p || ' kan geen rekenvoorbeeld maken (mag geen toewijzing vastleggen)'
)
from unnest(array['lmc_a', 'beheerder', 'manager_aal1', 'anon']) as p;

select matches(
  pg_temp.vb('coordinator', format(
    'null, %L, ''00000000-0000-4000-8000-0000000001d1'', (select id from public.schooljaar where naam = ''2026-2027''),
     ''handmatig'', null, null, null, null, null, ''schoolweken'', null, null, null',
    tests.mw('lmc_a'))),
  '^fout:23514',
  'Handmatig zonder uren geeft dezelfde controlefout als bij opslaan'
);

select matches(
  pg_temp.vb('coordinator', format(
    '''00000000-0000-4000-8000-0000000009e9'', %L, ''00000000-0000-4000-8000-0000000001d1'',
     (select id from public.schooljaar where naam = ''2026-2027''),
     ''handmatig'', null, null, 1, 0, 0, ''schoolweken'', null, null, null',
    tests.mw('lmc_a'))),
  '^fout:P0002',
  'Een onbekende toewijzing geeft P0002'
);

select * from finish();
rollback;
