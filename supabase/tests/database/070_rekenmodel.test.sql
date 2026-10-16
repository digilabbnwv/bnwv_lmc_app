-- Rekenmodel (SPEC §5): de verplichte testcases A t/m D en aanvullende regels.
-- Alle gegevens worden hier binnen de transactie gezet, los van de seed.
begin;
create extension if not exists pgtap with schema extensions;
select * from no_plan();

-- ---------------------------------------------------------------------------
-- Vaste testomgeving: schooljaar 2026-2027 en de testfeestdagen uit SPEC §5
-- ---------------------------------------------------------------------------

delete from public.feestdag where datum between '2026-08-01' and '2027-07-31';
insert into public.feestdag (datum, naam) values
  ('2026-12-25', 'Test'), ('2026-12-26', 'Test (zaterdag)'), ('2027-01-01', 'Test'),
  ('2027-03-29', 'Test'), ('2027-04-27', 'Test'), ('2027-05-06', 'Test'), ('2027-05-17', 'Test');

delete from public.instelling where sleutel in ('overhead_percentage', 'grens_vol', 'grens_boven_capaciteit');
insert into public.instelling (sleutel, waarde, ingangsdatum) values
  ('overhead_percentage', '15', '2020-01-01'),
  ('grens_vol', '85', '2020-01-01'),
  ('grens_boven_capaciteit', '100', '2020-01-01');

insert into public.medewerker (id, voornaam, achternaam, email) values
  ('00000000-0000-4000-8000-0000000000aa', 'Test', 'Casus A', 'casus-a@voorbeeld.test'),
  ('00000000-0000-4000-8000-0000000000bb', 'Test', 'Casus B', 'casus-b@voorbeeld.test'),
  ('00000000-0000-4000-8000-0000000000dd', 'Test', 'Casus D', 'casus-d@voorbeeld.test');

-- A: 24 uur/week het hele jaar
insert into public.contract (medewerker_id, uren_per_week, geldig_van, geldig_tot) values
  ('00000000-0000-4000-8000-0000000000aa', 24, '2026-08-01', null),
-- B: 24 uur t/m 31-12-2026, 28 uur vanaf 1-1-2027
  ('00000000-0000-4000-8000-0000000000bb', 24, '2026-08-01', '2026-12-31'),
  ('00000000-0000-4000-8000-0000000000bb', 28, '2027-01-01', null),
-- D: 28 uur
  ('00000000-0000-4000-8000-0000000000dd', 28, '2026-08-01', null);

insert into public.vakantie_uren (medewerker_id, kalenderjaar, uren) values
  ('00000000-0000-4000-8000-0000000000aa', 2026, 150),
  ('00000000-0000-4000-8000-0000000000aa', 2027, 160),
  ('00000000-0000-4000-8000-0000000000bb', 2026, 150),
  ('00000000-0000-4000-8000-0000000000bb', 2027, 160);

create temporary table casus_a as
select * from public.capaciteit_per_dag('00000000-0000-4000-8000-0000000000aa', '2026-08-01', '2027-07-31');
create temporary table casus_b as
select * from public.capaciteit_per_dag('00000000-0000-4000-8000-0000000000bb', '2026-08-01', '2027-07-31');

-- ---------------------------------------------------------------------------
-- Testcase A
-- ---------------------------------------------------------------------------

select is((select count(*)::int from casus_a), 260, 'A: 260 werkdagen in schooljaar 2026-2027');
select is((select count(*)::int from casus_a where feestdag), 6, 'A: 6 feestdagen op een werkdag');
select is((select round(sum(bruto), 4) from casus_a), 1219.2000, 'A: bruto = 1219,2');
select is((select round(sum(vakantie), 4) from casus_a), 155.2107, 'A: vakantie = 155,2107');
select is((select round(sum(netto), 4) from casus_a), 1063.9893, 'A: netto = 1063,9893');
select is((select round(sum(inzetbaar), 4) from casus_a), 904.3909, 'A: inzetbaar = 904,3909');
select is(private.werkdagen_in_jaar(2026), 261, 'A: 261 werkdagen in kalenderjaar 2026');
select is(
  (select count(*)::int from casus_a where datum <= '2026-12-31'), 109,
  'A: 109 werkdagen van 2026 binnen het schooljaar'
);
select is(
  (select round(inzetbaar, 4) from public.belasting('2026-08-01', '2027-07-31')
   where medewerker_id = '00000000-0000-4000-8000-0000000000aa'),
  904.3909,
  'A: belasting() geeft dezelfde inzetbare uren'
);
select is(
  (select round(inzetbaar, 4) from public.belasting_schooljaar
   where medewerker_id = '00000000-0000-4000-8000-0000000000aa' and schooljaar = '2026-2027'),
  904.3909,
  'A: belasting_schooljaar geeft dezelfde inzetbare uren'
);

-- ---------------------------------------------------------------------------
-- Testcase B
-- ---------------------------------------------------------------------------

select is((select round(sum(bruto), 4) from casus_b), 1336.0000, 'B: bruto = 1336,0');
select is((select round(sum(netto), 4) from casus_b), 1180.7893, 'B: netto = 1180,7893');
select is((select round(sum(inzetbaar), 4) from casus_b), 1003.6709, 'B: inzetbaar = 1003,6709');
select is(
  (select contracturen_dag from casus_b where datum = '2026-12-31'), 4.8,
  'B: op 31-12-2026 geldt het contract van 24 uur'
);
select is(
  (select contracturen_dag from casus_b where datum = '2027-01-04'), 5.6,
  'B: op 4-1-2027 geldt het contract van 28 uur'
);

-- ---------------------------------------------------------------------------
-- Testcase D: 50% niet beschikbaar, 10 werkdagen zonder feestdag in 2027, 28 uur/week
-- ---------------------------------------------------------------------------

create temporary table casus_d_voor as
select sum(bruto) as bruto
from public.capaciteit_per_dag('00000000-0000-4000-8000-0000000000dd', '2026-08-01', '2027-07-31');

insert into public.niet_beschikbaar (medewerker_id, van, tot, beschikbaarheidspercentage)
values ('00000000-0000-4000-8000-0000000000dd', '2027-03-01', '2027-03-12', 50);

select is(
  (select count(*)::int from public.capaciteit_per_dag('00000000-0000-4000-8000-0000000000dd', '2027-03-01', '2027-03-12')
   where not feestdag),
  10,
  'D: de periode bevat 10 werkdagen zonder feestdag'
);
select is(
  (select bruto from casus_d_voor)
    - (select sum(bruto) from public.capaciteit_per_dag('00000000-0000-4000-8000-0000000000dd', '2026-08-01', '2027-07-31')),
  28.0,
  'D: de bruto capaciteit neemt af met 28 uur'
);

-- ---------------------------------------------------------------------------
-- Testcase C: school PO, staffel 50 uur, factor 2,0 → 100 uur over de schoolweken
-- ---------------------------------------------------------------------------

delete from public.staffel
where schooljaar_id = (select id from public.schooljaar where naam = '2026-2027') and schooltype = 'PO';
insert into public.staffel (schooljaar_id, schooltype, leerlingen_min, leerlingen_max, uren)
select id, 'PO', 0, null, 50 from public.schooljaar where naam = '2026-2027';
update public.opslagfactor set factor = 2.0
where schooljaar_id = (select id from public.schooljaar where naam = '2026-2027') and schooltype = 'PO';

insert into public.werkpakket (id, soort, naam, vestiging)
values ('00000000-0000-4000-8000-0000000000c1', 'school', 'Testschool C', 'HAR');
insert into public.school (werkpakket_id, schooltype) values ('00000000-0000-4000-8000-0000000000c1', 'PO');
insert into public.school_schooljaar (school_id, schooljaar_id, aantal_leerlingen)
select '00000000-0000-4000-8000-0000000000c1', id, 250 from public.schooljaar where naam = '2026-2027';
insert into public.toewijzing (id, medewerker_id, werkpakket_id, schooljaar_id, bron, verdeling)
select '00000000-0000-4000-8000-0000000000c2', '00000000-0000-4000-8000-0000000000aa',
  '00000000-0000-4000-8000-0000000000c1', id, 'staffel', 'schoolweken'
from public.schooljaar where naam = '2026-2027';

-- Onafhankelijk geteld: werkdagen zonder feestdag en buiten de schoolvakanties.
create temporary table schoolweekdagen as
select d::date as datum
from generate_series('2026-08-01'::date, '2027-07-31'::date, interval '1 day') d
where extract(isodow from d) < 6
  and not exists (select 1 from public.feestdag f where f.datum = d::date)
  and not exists (
    select 1 from public.schoolvakantie sv
    join public.schooljaar sj on sj.id = sv.schooljaar_id and sj.naam = '2026-2027'
    where d::date between sv.van and sv.tot
  );

select is(
  (select round(totaal, 4) from public.toewijzing_uren where toewijzing_id = '00000000-0000-4000-8000-0000000000c2'),
  100.0000,
  'C: gepland 100 uur (staffel 50 × factor 2,0)'
);
select is(
  (select uitvoering from public.toewijzing_uren where toewijzing_id = '00000000-0000-4000-8000-0000000000c2'),
  50.0,
  'C: staffeluren tellen als uitvoering (50)'
);
select is(
  (select voorbereiding + afronding from public.toewijzing_uren where toewijzing_id = '00000000-0000-4000-8000-0000000000c2'),
  50.0,
  'C: de opslag telt als voorbereiding_afronding (50)'
);
select is(
  (select round(sum(totaal), 4) from public.toewijzing_dag where toewijzing_id = '00000000-0000-4000-8000-0000000000c2'),
  100.0000,
  'C: over de dagen opgeteld weer 100 uur'
);
select is(
  (select count(*)::int from public.toewijzing_dag where toewijzing_id = '00000000-0000-4000-8000-0000000000c2'),
  (select count(*)::int from schoolweekdagen),
  'C: verdeeld over precies alle schoolweekdagen'
);
select is_empty(
  $$select datum from public.toewijzing_dag where toewijzing_id = '00000000-0000-4000-8000-0000000000c2'
    except select datum from schoolweekdagen$$,
  'C: geen uren op feestdagen, in schoolvakanties of in het weekend'
);
select is(
  (select count(distinct totaal)::int from public.toewijzing_dag where toewijzing_id = '00000000-0000-4000-8000-0000000000c2'),
  1,
  'C: elke schoolweekdag krijgt precies evenveel uren'
);
select ok(
  (select count(*) from schoolweekdagen) between 150 and 230,
  'C: aantal schoolweekdagen is aannemelijk'
);

-- ---------------------------------------------------------------------------
-- Aanvullend: staffel, activiteit, project en verdelingen
-- ---------------------------------------------------------------------------

-- Gedeelde school: 60/40
insert into public.toewijzing (medewerker_id, werkpakket_id, schooljaar_id, bron, aandeel_percentage, verdeling)
select '00000000-0000-4000-8000-0000000000bb', '00000000-0000-4000-8000-0000000000c1', id, 'staffel', 40, 'schoolweken'
from public.schooljaar where naam = '2026-2027';
update public.toewijzing set aandeel_percentage = 60 where id = '00000000-0000-4000-8000-0000000000c2';

select is(
  (select round(sum(totaal), 4) from public.toewijzing_uren where werkpakket_id = '00000000-0000-4000-8000-0000000000c1'),
  100.0000,
  'Gedeelde school: 60% + 40% = samen weer 100 uur'
);
select is(
  (select round(totaal, 4) from public.toewijzing_uren where toewijzing_id = '00000000-0000-4000-8000-0000000000c2'),
  60.0000,
  'Gedeelde school: aandeel 60% geeft 60 uur'
);

-- Handmatige staffeluren gaan voor de staffel
update public.school_schooljaar set uren_handmatig = 80, toelichting = 'Test'
where school_id = '00000000-0000-4000-8000-0000000000c1';
select is(
  (select round(sum(totaal), 4) from public.toewijzing_uren where werkpakket_id = '00000000-0000-4000-8000-0000000000c1'),
  160.0000,
  'Handmatige staffeluren (80) × factor 2,0 = 160 uur'
);

-- Activiteit: aantal_keer × normuren, verdeeld op datum
insert into public.activiteittype (id, naam, normuren_uitvoering, normuren_voorbereiding, normuren_afronding)
values ('00000000-0000-4000-8000-0000000000e1', 'Testactiviteit', 2, 1, 0.5);
insert into public.werkpakket (id, soort, naam, vestiging, activiteittype_id)
values ('00000000-0000-4000-8000-0000000000e2', 'activiteit', 'Test Digilab', 'NUN', '00000000-0000-4000-8000-0000000000e1');
insert into public.toewijzing (id, medewerker_id, werkpakket_id, schooljaar_id, bron, aantal_keer, verdeling)
select '00000000-0000-4000-8000-0000000000e3', '00000000-0000-4000-8000-0000000000aa',
  '00000000-0000-4000-8000-0000000000e2', id, 'norm_x_aantal', 4, 'op_datum'
from public.schooljaar where naam = '2026-2027';
insert into public.toewijzing_datum (toewijzing_id, datum) values
  ('00000000-0000-4000-8000-0000000000e3', '2026-10-07'),
  ('00000000-0000-4000-8000-0000000000e3', '2026-11-11');

select results_eq(
  $$select uitvoering, voorbereiding, afronding from public.toewijzing_uren
    where toewijzing_id = '00000000-0000-4000-8000-0000000000e3'$$,
  $$values (8.0, 4.0, 2.0)$$,
  'Activiteit: 4 × normuren (2 / 1 / 0,5)'
);
select results_eq(
  $$select datum, totaal from public.toewijzing_dag
    where toewijzing_id = '00000000-0000-4000-8000-0000000000e3' order by datum$$,
  $$values ('2026-10-07'::date, 7.0), ('2026-11-11'::date, 7.0)$$,
  'Verdeling op_datum: elke datum een gelijk deel'
);

-- Project: handmatig over een looptijd met kerstvakantie en feestdagen
insert into public.werkpakket (id, soort, naam, vestiging)
values ('00000000-0000-4000-8000-0000000000f1', 'project', 'Testproject', 'overig');
insert into public.toewijzing (id, medewerker_id, werkpakket_id, schooljaar_id, bron,
  gepland_uitvoering, gepland_voorbereiding, gepland_afronding, verdeling, looptijd_van, looptijd_tot)
select '00000000-0000-4000-8000-0000000000f2', '00000000-0000-4000-8000-0000000000aa',
  '00000000-0000-4000-8000-0000000000f1', id, 'handmatig', 10, 2.5, 0.5, 'looptijd', '2026-12-21', '2027-01-08'
from public.schooljaar where naam = '2026-2027';

-- 21-12 t/m 8-1: 15 werkdagen, waarvan 25-12 en 1-1 feestdag → 13 dagen (vakantie telt mee).
select is(
  (select count(*)::int from public.toewijzing_dag where toewijzing_id = '00000000-0000-4000-8000-0000000000f2'),
  13,
  'Looptijd: werkdagen zonder feestdagen, schoolvakantie telt mee'
);
select is(
  (select round(sum(totaal), 4) from public.toewijzing_dag where toewijzing_id = '00000000-0000-4000-8000-0000000000f2'),
  13.0000,
  'Project: alle handmatige uren (10 + 2,5 + 0,5) worden verdeeld'
);
select is_empty(
  $$select 1 from public.toewijzing_dag where toewijzing_id = '00000000-0000-4000-8000-0000000000f2'
    and datum in ('2026-12-25', '2027-01-01')$$,
  'Looptijd: geen uren op feestdagen'
);

-- Terugval: looptijd die alleen in het weekend valt
insert into public.toewijzing (id, medewerker_id, werkpakket_id, schooljaar_id, bron,
  gepland_uitvoering, gepland_voorbereiding, gepland_afronding, verdeling, looptijd_van, looptijd_tot)
select '00000000-0000-4000-8000-0000000000f3', '00000000-0000-4000-8000-0000000000bb',
  '00000000-0000-4000-8000-0000000000f1', id, 'handmatig', 3, 0, 0, 'looptijd', '2026-10-03', '2026-10-04'
from public.schooljaar where naam = '2026-2027';
select results_eq(
  $$select datum, totaal, terugval from public.toewijzing_dag
    where toewijzing_id = '00000000-0000-4000-8000-0000000000f3'$$,
  $$values ('2026-10-03'::date, 3.0, true)$$,
  'Geen geschikte dag: uren op de eerste dag, gemarkeerd als terugval'
);

-- ---------------------------------------------------------------------------
-- Aanvullend: overhead per dag
-- ---------------------------------------------------------------------------

insert into public.instelling (sleutel, waarde, ingangsdatum) values ('overhead_percentage', '20', '2027-01-01');
select is(
  (select round(sum(inzetbaar), 4)
   from public.capaciteit_per_dag('00000000-0000-4000-8000-0000000000aa', '2026-08-01', '2027-07-31')),
  round((518.4 - 150 * 109 / 261.0) * 0.85 + (700.8 - 160 * 151 / 261.0) * 0.80, 4),
  'Overhead wijzigt per 1-1-2027: elke dag rekent met de overhead die dan geldt'
);
delete from public.instelling where sleutel = 'overhead_percentage' and ingangsdatum = '2027-01-01';

-- ---------------------------------------------------------------------------
-- Aanvullend: signaalzones en belastingsgraad
-- ---------------------------------------------------------------------------

select is(private.signaalzone(0.849, 85, 100), 'ruimte', 'Zone: 84,9% is ruimte');
select is(private.signaalzone(0.85, 85, 100), 'vol', 'Zone: 85% is vol');
select is(private.signaalzone(1.00, 85, 100), 'vol', 'Zone: 100% is vol');
select is(private.signaalzone(1.001, 85, 100), 'boven_capaciteit', 'Zone: 100,1% is boven capaciteit');
select is(private.signaalzone(null, 85, 100), null, 'Zone: geen inzetbare uren geeft geen zone');

select is(
  (select round(belastingsgraad, 6) from public.belasting('2026-08-01', '2027-07-31')
   where medewerker_id = '00000000-0000-4000-8000-0000000000aa'),
  (select round(
     (select sum(t.totaal) from public.toewijzing_uren t
      where t.medewerker_id = '00000000-0000-4000-8000-0000000000aa')
     / (select sum(inzetbaar) from casus_a), 6)),
  'Belastingsgraad = gepland ÷ inzetbaar'
);
select is(
  (select ruimte from public.belasting('2026-08-01', '2027-07-31')
   where medewerker_id = '00000000-0000-4000-8000-0000000000aa'),
  (select inzetbaar - gepland from public.belasting('2026-08-01', '2027-07-31')
   where medewerker_id = '00000000-0000-4000-8000-0000000000aa'),
  'Ruimte = inzetbaar − gepland'
);
insert into public.medewerker (id, voornaam, achternaam, email)
values ('00000000-0000-4000-8000-0000000000ee', 'Test', 'Zonder contract', 'casus-zonder@voorbeeld.test');
select results_eq(
  $$select belastingsgraad, zone, inzetbaar from public.belasting('2026-08-01', '2027-07-31')
    where medewerker_id = '00000000-0000-4000-8000-0000000000ee'$$,
  $$values (null::numeric, null::text, 0::numeric)$$,
  'Zonder contract: inzetbaar 0, geen belastingsgraad en geen zone'
);

-- ---------------------------------------------------------------------------
-- Aanvullend: per week en per maand
-- ---------------------------------------------------------------------------

select is(
  (select count(distinct periode_van)::int
   from public.belasting_per_periode((select id from public.schooljaar where naam = '2026-2027'), 'maand')),
  12,
  'Per maand: 12 perioden in een schooljaar'
);
select is(
  (select round(sum(inzetbaar), 4)
   from public.belasting_per_periode((select id from public.schooljaar where naam = '2026-2027'), 'week')
   where medewerker_id = '00000000-0000-4000-8000-0000000000bb'),
  1003.6709,
  'Per week opgeteld = inzetbaar over het schooljaar (testcase B)'
);
select is(
  (select min(periode_van) from public.belasting_per_periode((select id from public.schooljaar where naam = '2026-2027'), 'week')),
  '2026-08-01'::date,
  'De eerste week wordt afgekapt op het begin van het schooljaar'
);
select throws_ok(
  $$select * from public.belasting_per_periode((select id from public.schooljaar where naam = '2026-2027'), 'dag')$$,
  '22023', null, 'Alleen week of maand als eenheid'
);

-- ---------------------------------------------------------------------------
-- RLS: de rekenfuncties en views volgen de rechten op de onderliggende tabellen
-- ---------------------------------------------------------------------------

select tests.maak_personas();
insert into public.contract (medewerker_id, uren_per_week, geldig_van) values
  (tests.mw('lmc_a'), 20, '2026-08-01'), (tests.mw('lmc_b'), 20, '2026-08-01');
insert into public.toewijzing (medewerker_id, werkpakket_id, schooljaar_id, bron,
  gepland_uitvoering, gepland_voorbereiding, gepland_afronding, verdeling, looptijd_van, looptijd_tot)
select tests.mw(p.naam), '00000000-0000-4000-8000-0000000000f1', sj.id, 'handmatig', 5, 1, 1,
  'looptijd', '2026-09-01', '2026-09-30'
from (values ('lmc_a'), ('lmc_b')) as p (naam), public.schooljaar sj
where sj.naam = '2026-2027';

select matches(
  tests.aantal('lmc_a', $$select * from public.belasting('2026-08-01', '2027-07-31')$$),
  '^rijen:1$', 'lmc A ziet in belasting() alleen zichzelf'
);
select matches(
  tests.aantal('lmc_a', $$select * from public.belasting_schooljaar$$),
  '^rijen:' || (select count(*) from public.schooljaar) || '$',
  'lmc A ziet in belasting_schooljaar alleen zichzelf (één rij per schooljaar)'
);
select matches(
  tests.aantal('lmc_a', $$select * from public.capaciteit_per_dag(tests.mw('lmc_b'), '2026-08-01', '2027-07-31')$$),
  '^rijen:0$', 'lmc A krijgt geen capaciteit van B, ook niet met het ID van B'
);
select matches(
  tests.aantal('lmc_a', $$select * from public.toewijzing_dag where medewerker_id = tests.mw('lmc_b')$$),
  '^rijen:0$', 'lmc A ziet de dagverdeling van B niet'
);
select matches(
  tests.aantal('lmc_a', $$select * from public.toewijzing_uren$$),
  '^rijen:1$', 'lmc A ziet alleen de eigen toewijzing in toewijzing_uren'
);
select is(
  tests.waarde('lmc_a', $$select round(sum(inzetbaar), 4)
    from public.capaciteit_per_dag(tests.mw('lmc_a'), '2026-08-01', '2027-07-31')$$),
  (select round(sum(inzetbaar), 4)::text
   from public.capaciteit_per_dag(tests.mw('lmc_a'), '2026-08-01', '2027-07-31')),
  'lmc A krijgt voor zichzelf dezelfde capaciteit als zonder RLS'
);
select matches(
  tests.aantal('coordinator', $$select * from public.belasting('2026-08-01', '2027-07-31')$$),
  '^rijen:' || (select count(*) from public.medewerker) || '$',
  'Coordinator ziet alle medewerkers in belasting()'
);
select matches(
  tests.aantal('lmc_a_aal1', $$select * from public.belasting('2026-08-01', '2027-07-31')$$),
  '^rijen:0$', 'Op aal1 geeft belasting() niets'
);
select matches(
  tests.aantal('lmc_a_aal1', $$select * from public.capaciteit_per_dag(tests.mw('lmc_a'), '2026-08-01', '2027-07-31')$$),
  '^rijen:0$', 'Op aal1 geeft capaciteit_per_dag() niets, ook niet voor jezelf'
);
select matches(
  tests.aantal('anon', $$select * from public.belasting('2026-08-01', '2027-07-31')$$),
  '^geweigerd$', 'anon kan belasting() niet aanroepen'
);
select matches(
  tests.aantal('anon', $$select * from public.belasting_schooljaar$$),
  '^geweigerd$', 'anon kan belasting_schooljaar niet lezen'
);

select * from finish();
rollback;
