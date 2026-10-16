-- Weergaven (SPEC §9): gepland versus gerealiseerd.
begin;
create extension if not exists pgtap with schema extensions;
select * from no_plan();

select tests.maak_personas();

-- Toewijzing voor lmc A: project met 10 uur uitvoering, 4 voorbereiding, 2 afronding
-- over 1 t/m 30 september 2026 (22 werkdagen).
insert into public.toewijzing (medewerker_id, werkpakket_id, schooljaar_id, bron,
  gepland_uitvoering, gepland_voorbereiding, gepland_afronding, verdeling, looptijd_van, looptijd_tot)
select tests.mw('lmc_a'), w.id, s.id, 'handmatig', 10, 4, 2, 'looptijd', '2026-09-01', '2026-09-30'
from public.werkpakket w, public.schooljaar s
where w.naam = 'Kinderboekenweek' and s.naam = '2026-2027';

-- Gerealiseerd: een definitieve import met boekingen op het gekoppelde project 956
-- (Kinderboekenweek), op het niet-gekoppelde project 777 en een genegeerd project 778.
insert into public.matt_project (projectnummer, naam_laatst_gezien) values ('777', 'Los'), ('778', 'Genegeerd');
update public.matt_project set genegeerd = true where projectnummer = '778';
insert into public.matt_import (id, periode_van, periode_tot, status)
values ('00000000-0000-4000-8000-00000000f001', '2026-09-01', '2026-10-31', 'definitief'),
       ('00000000-0000-4000-8000-00000000f002', '2026-09-01', '2026-10-31', 'concept');
insert into public.boeking (import_id, medewerker_id, matt_project_id, artikelcode, categorie, datum, uren)
select v.imp::uuid, tests.mw(v.wie), p.id, v.art, v.cat::public.boeking_categorie, v.datum::date, v.uren
from (values
  ('00000000-0000-4000-8000-00000000f001', 'lmc_a', '956', '10', 'uitvoering', '2026-09-10', 3.0),
  ('00000000-0000-4000-8000-00000000f001', 'lmc_a', '956', '11', 'voorbereiding_afronding', '2026-10-20', 1.5),
  ('00000000-0000-4000-8000-00000000f001', 'lmc_a', '956', '12', 'relatiebeheer', '2026-09-11', 0.5),
  ('00000000-0000-4000-8000-00000000f001', 'lmc_a', '777', '10', 'uitvoering', '2026-09-12', 2.0),
  ('00000000-0000-4000-8000-00000000f001', 'lmc_a', '778', '10', 'uitvoering', '2026-09-13', 9.0),
  ('00000000-0000-4000-8000-00000000f002', 'lmc_a', '956', '10', 'uitvoering', '2026-09-14', 8.0),
  ('00000000-0000-4000-8000-00000000f001', 'lmc_b', '956', '10', 'uitvoering', '2026-09-15', 4.0)
) as v (imp, wie, nummer, art, cat, datum, uren)
join public.matt_project p on p.projectnummer = v.nummer;

create temporary table resultaat as
select * from public.gepland_vs_gerealiseerd(
  tests.mw('lmc_a'), (select id from public.schooljaar where naam = '2026-2027'), '2026-09-15');

select results_eq(
  $$select categorie::text, round(gepland, 4), round(gerealiseerd, 4) from resultaat
    where werkpakket_naam = 'Kinderboekenweek' order by categorie$$,
  $$values ('uitvoering', 10.0000, 3.0000), ('voorbereiding_afronding', 6.0000, 1.5000),
           ('relatiebeheer', 0.0000, 0.5000)$$,
  'Per categorie: gepland (voorbereiding + afronding samen) naast gerealiseerd; relatiebeheer niet gepland'
);

select is(
  (select round(gerealiseerd, 4) from resultaat where werkpakket_id is null and categorie = 'uitvoering'),
  2.0000, 'Uren op een niet-gekoppeld MATT-project staan apart (werkpakket leeg)'
);
select is(
  (select round(sum(gerealiseerd), 4) from resultaat), 7.0000,
  'Genegeerde projecten, concepten en boekingen van anderen tellen niet mee'
);

-- Tot de peildatum 15-9-2026: 11 van de 22 werkdagen in september.
select is(
  (select round(gepland_tot_peildatum, 4) from resultaat
   where werkpakket_naam = 'Kinderboekenweek' and categorie = 'uitvoering'),
  round(10 * 11 / 22.0, 4), 'Gepland tot de peildatum volgt de dagverdeling'
);
select is(
  (select round(gerealiseerd_tot_peildatum, 4) from resultaat
   where werkpakket_naam = 'Kinderboekenweek' and categorie = 'voorbereiding_afronding'),
  0.0000, 'Gerealiseerd na de peildatum telt niet mee in "tot vandaag"'
);

-- RLS
select matches(
  tests.aantal('lmc_a', $$select * from public.gepland_vs_gerealiseerd(
    tests.mw('lmc_a'), (select id from public.schooljaar where naam = '2026-2027'), '2026-09-15')$$),
  '^rijen:4$', 'lmc A ziet de eigen cijfers'
);
select matches(
  tests.aantal('lmc_a', $$select * from public.gepland_vs_gerealiseerd(
    tests.mw('lmc_b'), (select id from public.schooljaar where naam = '2026-2027'), '2026-09-15')$$),
  '^rijen:0$', 'lmc A krijgt niets van B, ook niet met het ID van B'
);
select matches(
  tests.aantal('coordinator', $$select * from public.gepland_vs_gerealiseerd(
    tests.mw('lmc_b'), (select id from public.schooljaar where naam = '2026-2027'), '2026-09-15')$$),
  '^rijen:1$', 'Coordinator ziet de cijfers van B'
);
select matches(
  tests.aantal('lmc_a_aal1', $$select * from public.gepland_vs_gerealiseerd(
    tests.mw('lmc_a'), (select id from public.schooljaar where naam = '2026-2027'), '2026-09-15')$$),
  '^rijen:0$', 'Op aal1 geeft de functie niets'
);
select matches(
  tests.aantal('anon', $$select * from public.gepland_vs_gerealiseerd(
    tests.mw('lmc_a'), (select id from public.schooljaar where naam = '2026-2027'), '2026-09-15')$$),
  '^geweigerd$', 'anon kan de functie niet aanroepen'
);

select * from finish();
rollback;
