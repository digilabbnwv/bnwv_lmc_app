-- Realisatie: imports, boekingen en omschrijvingen (SPEC §6, §8).
begin;
create extension if not exists pgtap with schema extensions;
select * from no_plan();

select tests.maak_personas();

-- Een definitieve en een teruggedraaide import, met boekingen voor lmc A, lmc B en de manager.
insert into public.matt_import (id, uitgevoerd_door, periode_van, periode_tot, status, totaal_uren)
values
  ('00000000-0000-4000-8000-0000000000a1', tests.gb('coordinator'), '2026-01-01', '2026-03-31', 'definitief', 12),
  ('00000000-0000-4000-8000-0000000000a2', tests.gb('coordinator'), '2026-01-01', '2026-03-31', 'teruggedraaid', 1);

insert into public.boeking (id, import_id, medewerker_id, matt_project_id, artikelcode, categorie, datum, uren, uren_open)
select v.id::uuid, v.import_id::uuid, tests.mw(v.persona), p.id, '10', 'uitvoering', v.datum::date, v.uren, 0
from (values
  ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000a1', 'lmc_a', '2026-01-08', 3),
  ('00000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-0000000000a1', 'lmc_a', '2026-02-12', 2),
  ('00000000-0000-4000-8000-0000000000b3', '00000000-0000-4000-8000-0000000000a1', 'lmc_b', '2026-01-15', 4),
  ('00000000-0000-4000-8000-0000000000b4', '00000000-0000-4000-8000-0000000000a1', 'manager', '2026-01-20', 3),
  ('00000000-0000-4000-8000-0000000000b5', '00000000-0000-4000-8000-0000000000a2', 'lmc_b', '2026-01-16', 1)
) as v (id, import_id, persona, datum, uren)
join public.matt_project p on p.projectnummer = '901';

insert into public.boeking_omschrijving (boeking_id, omschrijving) values
  ('00000000-0000-4000-8000-0000000000b1', 'Voorlezen groep 3'),
  ('00000000-0000-4000-8000-0000000000b2', 'Overleg leerkracht'),
  ('00000000-0000-4000-8000-0000000000b3', 'Omschrijving van B'),
  ('00000000-0000-4000-8000-0000000000b4', 'Omschrijving van de manager'),
  ('00000000-0000-4000-8000-0000000000b5', 'Teruggedraaid');

-- ---------------------------------------------------------------------------
-- Rechtenmatrix: geen enkele rol schrijft rechtstreeks (alleen via RPC's, fase 5).
-- ---------------------------------------------------------------------------

select * from tests.matrix(
  'public.matt_import', tests.lees_cmb(), null, '{}',
  $$insert into public.matt_import (periode_van, periode_tot) values ('2026-04-01', '2026-04-30')$$,
  $$update public.matt_import set status = 'definitief'$$,
  $$delete from public.matt_import$$
);

select * from tests.matrix(
  'public.boeking', tests.lees_eigen_of_cmb(), 'medewerker_id = $mw', '{}',
  $$insert into public.boeking (import_id, medewerker_id, matt_project_id, artikelcode, datum, uren)
    select '00000000-0000-4000-8000-0000000000a1', tests.mw('lmc_a'), id, '10', '2026-03-01', 99
    from public.matt_project where projectnummer = '901'$$,
  $$update public.boeking set uren = 99$$,
  $$delete from public.boeking$$
);

-- Omschrijvingen: rechtstreeks alleen de eigen, voor élke rol (ook coordinator en beheerder).
select * from tests.matrix(
  'public.boeking_omschrijving',
  '{"lmc_a":"eigen","lmc_b":"eigen","coordinator":"eigen","manager":"eigen","beheerder":"eigen"}',
  'boeking_id in (select id from public.boeking where medewerker_id = $mw)',
  '{}',
  $$insert into public.boeking_omschrijving (boeking_id, omschrijving)
    select id, 'Nieuw' from public.boeking where id not in (select boeking_id from public.boeking_omschrijving)$$,
  $$update public.boeking_omschrijving set omschrijving = 'Vervalst'$$,
  $$delete from public.boeking_omschrijving$$
);

-- ---------------------------------------------------------------------------
-- Expliciete eisen uit SPEC §6
-- ---------------------------------------------------------------------------

select matches(
  tests.aantal('lmc_a', $$select * from public.boeking where medewerker_id = tests.mw('lmc_b')$$),
  '^rijen:0$', 'lmc A ziet de boekingen van B niet via het ID van B'
);

select matches(
  tests.aantal('lmc_a', $$select * from public.boeking_omschrijving
    where boeking_id = '00000000-0000-4000-8000-0000000000b3'$$),
  '^rijen:0$', 'lmc A ziet de omschrijving van B niet via het boeking-ID'
);

select matches(
  tests.aantal('lmc_a', $$select * from public.boeking_omschrijving$$),
  '^rijen:2$', 'lmc A ziet zijn eigen omschrijvingen'
);

select matches(
  tests.aantal('manager', $$select * from public.boeking where medewerker_id = tests.mw('lmc_b')$$),
  '^rijen:2$', 'Manager ziet de boekingen van anderen (zonder omschrijving)'
);

select matches(
  tests.aantal('manager', $$select * from public.boeking_omschrijving
    where boeking_id = '00000000-0000-4000-8000-0000000000b3'$$),
  '^rijen:0$', 'Manager kan boeking_omschrijving van anderen niet lezen'
);

select matches(
  tests.aantal('manager', $$select * from public.boeking_omschrijving$$),
  '^rijen:1$', 'Manager ziet alleen zijn eigen omschrijving'
);

select matches(
  tests.aantal('coordinator', $$select * from public.boeking_omschrijving
    where boeking_id = '00000000-0000-4000-8000-0000000000b3'$$),
  '^rijen:0$', 'Ook de coordinator leest omschrijvingen van anderen niet rechtstreeks'
);

-- RPC voor boekingdetails van een ander
select matches(
  tests.probeer('manager', $$select * from public.boeking_details_van_ander(
    tests.mw('lmc_b'), '2026-01-01', '2026-03-31')$$),
  '^geweigerd$', 'Manager kan de RPC voor boekingdetails niet gebruiken'
);

select matches(
  tests.probeer('lmc_a', $$select * from public.boeking_details_van_ander(
    tests.mw('lmc_b'), '2026-01-01', '2026-03-31')$$),
  '^geweigerd$', 'lmc A kan via de RPC de details van B niet opvragen'
);

select matches(
  tests.probeer('anon', $$select * from public.boeking_details_van_ander(
    tests.mw('lmc_b'), '2026-01-01', '2026-03-31')$$),
  '^geweigerd$', 'anon kan de RPC niet aanroepen'
);

select matches(
  tests.probeer('coordinator', $$select * from public.boeking_details_van_ander(
    tests.mw('lmc_b'), '2026-01-01', '2026-03-31')$$),
  '^rijen:1$', 'Coordinator krijgt via de RPC de details van B (zonder teruggedraaide boekingen)'
);

select matches(
  tests.probeer('beheerder', $$select * from public.boeking_details_van_ander(
    tests.mw('lmc_b'), '2026-01-01', '2026-03-31')$$),
  '^rijen:1$', 'Beheerder krijgt via de RPC de details van B'
);

select matches(
  tests.probeer('manager_aal1', $$select * from public.boeking_details_van_ander(
    tests.mw('lmc_b'), '2026-01-01', '2026-03-31')$$),
  '^geweigerd$', 'Op aal1 werkt de RPC niet'
);

-- Een echte aanroep als coordinator: de omschrijving komt mee en de opvraging wordt gelogd.
select is(
  tests.waarde('coordinator', $$select omschrijving
    from public.boeking_details_van_ander(tests.mw('lmc_b'), '2026-01-01', '2026-03-31')$$),
  'Omschrijving van B',
  'De RPC geeft de omschrijving terug'
);

do $$
begin
  perform tests.wissel('coordinator');
  perform * from public.boeking_details_van_ander(tests.mw('lmc_b'), '2026-01-01', '2026-03-31');
end
$$;
reset role;

select ok(
  exists (
    select 1 from public.auditlog
    where actie = 'boeking_details_ingezien'
      and gebruiker_id = tests.gb('coordinator')
      and record_id = tests.mw('lmc_b')::text
      and (nieuwe_waarde ->> 'aantal')::int = 1
  ),
  'Het opvragen van boekingdetails staat in het auditlog'
);

select is_empty(
  $$select 1 from public.auditlog where nieuwe_waarde::text like '%Omschrijving van B%'
    or oude_waarde::text like '%Omschrijving van B%'$$,
  'Omschrijvingen komen nooit in het auditlog'
);

select is_empty(
  $$select 1 from pg_catalog.pg_trigger
    where tgrelid in ('public.boeking'::regclass, 'public.boeking_omschrijving'::regclass)
      and not tgisinternal$$,
  'Geen rij-audit op boeking en boeking_omschrijving (audit per import)'
);

select ok(
  exists (select 1 from pg_catalog.pg_trigger
    where tgrelid = 'public.matt_import'::regclass and tgname = 'audit'),
  'matt_import heeft een audit-trigger (audit per import)'
);

select * from finish();
rollback;
