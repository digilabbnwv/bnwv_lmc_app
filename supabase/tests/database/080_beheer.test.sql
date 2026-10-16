-- Beheer-RPC's (fase 4): school_opslaan, toewijzing_datums_vervangen en
-- schooljaar_configuratie_kopieren. RLS op de onderliggende tabellen beslist.
begin;
create extension if not exists pgtap with schema extensions;
select * from no_plan();

select tests.maak_personas();

-- ---------------------------------------------------------------------------
-- school_opslaan
-- ---------------------------------------------------------------------------

select matches(
  tests.probeer('coordinator', $$select public.school_opslaan(null, 'Nieuwe school', 'ERM', true, 'PO',
    'Voorbeeldstraat 9', '1234 AB', 'Ermelo')$$),
  '^rijen:1$', 'Coordinator legt een nieuwe school vast'
);
select matches(
  tests.probeer('manager', $$select public.school_opslaan(null, 'Nieuwe school', 'ERM', true, 'PO', null, null, null)$$),
  '^rijen:1$', 'Manager legt een nieuwe school vast'
);
select is(
  tests.probeer('beheerder', $$select public.school_opslaan(null, 'Nieuwe school', 'ERM', true, 'PO', null, null, null)$$),
  'geweigerd', 'Beheerder kan geen school vastleggen (SPEC §6)'
);
select is(
  tests.probeer('lmc_a', $$select public.school_opslaan(null, 'Nieuwe school', 'ERM', true, 'PO', null, null, null)$$),
  'geweigerd', 'lmc kan geen school vastleggen'
);
select is(
  tests.probeer('manager_aal1', $$select public.school_opslaan(null, 'Nieuwe school', 'ERM', true, 'PO', null, null, null)$$),
  'geweigerd', 'Op aal1 kan niemand een school vastleggen'
);
select is(
  tests.probeer('anon', $$select public.school_opslaan(null, 'Nieuwe school', 'ERM', true, 'PO', null, null, null)$$),
  'geweigerd', 'anon kan school_opslaan niet aanroepen'
);

-- Atomair: een ongeldige postcode laat ook geen werkpakket achter.
select matches(
  tests.probeer('coordinator', $$select public.school_opslaan(null, 'Halve school', 'ERM', true, 'PO',
    null, 'ONGELDIG', null)$$),
  '^fout:23514', 'Ongeldige postcode wordt geweigerd'
);
select is_empty(
  $$select 1 from public.werkpakket where naam = 'Halve school'$$,
  'Na een fout blijft er geen werkpakket zonder schoolgegevens achter'
);

-- Wijzigen
do $$
begin
  perform tests.wissel('coordinator');
  perform public.school_opslaan(null, 'Te wijzigen school', 'HAR', true, 'PO', null, null, 'Harderwijk');
end
$$;
reset role;

select matches(
  tests.probeer('coordinator', $$select public.school_opslaan(
    (select id from public.werkpakket where naam = 'Te wijzigen school'),
    'Gewijzigde school', 'NUN', false, 'VO', 'Nieuwe straat 1', '1234 CD', 'Nunspeet')$$),
  '^rijen:1$', 'Coordinator wijzigt een school'
);
select matches(
  tests.probeer('coordinator', $$select public.school_opslaan(
    (select w.id from public.werkpakket w where w.soort = 'project' limit 1),
    'Geen school', 'NUN', true, 'VO', null, null, null)$$),
  '^fout:P0002', 'Een project kan niet via school_opslaan worden gewijzigd'
);

-- ---------------------------------------------------------------------------
-- toewijzing_datums_vervangen
-- ---------------------------------------------------------------------------

insert into public.toewijzing (id, medewerker_id, werkpakket_id, schooljaar_id, bron, aantal_keer, verdeling)
select '00000000-0000-4000-8000-000000000a01', tests.mw('lmc_a'), w.id, s.id, 'norm_x_aantal', 3, 'op_datum'
from public.werkpakket w, public.schooljaar s
where w.naam = 'Digilab Nunspeet' and s.naam = '2026-2027';
insert into public.toewijzing_datum (toewijzing_id, datum)
values ('00000000-0000-4000-8000-000000000a01', '2026-09-02');

select matches(
  tests.probeer('coordinator', $$select public.toewijzing_datums_vervangen(
    '00000000-0000-4000-8000-000000000a01', array['2026-10-07', '2026-11-04', '2026-10-07']::date[])$$),
  '^rijen:1$', 'Coordinator vervangt de datums'
);
do $$
begin
  perform tests.wissel('coordinator');
  perform public.toewijzing_datums_vervangen(
    '00000000-0000-4000-8000-000000000a01', array['2026-10-07', '2026-11-04', '2026-10-07']::date[]);
end
$$;
reset role;
select results_eq(
  $$select datum from public.toewijzing_datum
    where toewijzing_id = '00000000-0000-4000-8000-000000000a01' order by datum$$,
  $$values ('2026-10-07'::date), ('2026-11-04'::date)$$,
  'De oude datum is weg; dubbele datums worden één keer opgeslagen'
);

select matches(
  tests.probeer('coordinator', $$select public.toewijzing_datums_vervangen(
    '00000000-0000-4000-8000-000000000a01', array['2026-10-07', '2028-01-01']::date[])$$),
  '^fout:23514', 'Een datum buiten het schooljaar wordt geweigerd'
);
select results_eq(
  $$select datum from public.toewijzing_datum
    where toewijzing_id = '00000000-0000-4000-8000-000000000a01' order by datum$$,
  $$values ('2026-10-07'::date), ('2026-11-04'::date)$$,
  'Na een fout blijven de bestaande datums staan (atomair)'
);
select is(
  tests.probeer('beheerder', $$select public.toewijzing_datums_vervangen(
    '00000000-0000-4000-8000-000000000a01', array['2026-10-08']::date[])$$),
  'geweigerd', 'Beheerder kan geen datums van toewijzingen wijzigen'
);
select matches(
  tests.probeer('lmc_a', $$select public.toewijzing_datums_vervangen(
    '00000000-0000-4000-8000-000000000a01', array['2026-10-08']::date[])$$),
  '^(geweigerd|fout:P0002)', 'lmc kan de eigen toewijzing niet wijzigen'
);
select matches(
  tests.probeer('lmc_b', $$select public.toewijzing_datums_vervangen(
    '00000000-0000-4000-8000-000000000a01', array['2026-10-08']::date[])$$),
  '^fout:P0002', 'lmc B ziet de toewijzing van A niet eens'
);

-- ---------------------------------------------------------------------------
-- schooljaar_configuratie_kopieren
-- ---------------------------------------------------------------------------

insert into public.schooljaar (id, naam, startdatum, einddatum)
values ('00000000-0000-4000-8000-000000000b01', '2027-2028', '2027-08-01', '2028-07-31');

select is(
  tests.probeer('lmc_a', $$select public.schooljaar_configuratie_kopieren(
    (select id from public.schooljaar where naam = '2026-2027'), '00000000-0000-4000-8000-000000000b01')$$),
  'geweigerd', 'lmc kan geen configuratie kopiëren'
);
-- Op aal1 zijn de schooljaren onzichtbaar; de functie stopt dan al bij de invoercontrole.
select matches(
  tests.probeer('manager_aal1', $$select public.schooljaar_configuratie_kopieren(
    (select id from public.schooljaar where naam = '2026-2027'), '00000000-0000-4000-8000-000000000b01')$$),
  '^(geweigerd|fout:22023 )', 'Op aal1 kan niemand configuratie kopiëren'
);
select is(
  tests.waarde('beheerder', $$select public.schooljaar_configuratie_kopieren(
    (select id from public.schooljaar where naam = '2026-2027'), '00000000-0000-4000-8000-000000000b01')$$),
  (select jsonb_build_object(
    'staffel', (select count(*) from public.staffel s join public.schooljaar j on j.id = s.schooljaar_id where j.naam = '2026-2027'),
    'opslagfactor', (select count(*) from public.opslagfactor o join public.schooljaar j on j.id = o.schooljaar_id where j.naam = '2026-2027'),
    'schoolvakantie', (select count(*) from public.schoolvakantie v join public.schooljaar j on j.id = v.schooljaar_id where j.naam = '2026-2027')
  )::text),
  'Beheerder kopieert staffel, opslagfactoren en schoolvakanties'
);

do $$
begin
  perform tests.wissel('coordinator');
  perform public.schooljaar_configuratie_kopieren(
    (select id from public.schooljaar where naam = '2026-2027'), '00000000-0000-4000-8000-000000000b01');
end
$$;
reset role;

select is(
  (select count(*)::int from public.opslagfactor
   where schooljaar_id = '00000000-0000-4000-8000-000000000b01' and bevestigd),
  0, 'Gekopieerde opslagfactoren zijn weer "nog te bevestigen"'
);
select is_empty(
  $$select 1 from public.schoolvakantie
    where schooljaar_id = '00000000-0000-4000-8000-000000000b01'
      and (van < '2027-08-01' or tot > '2028-07-31')$$,
  'Gekopieerde vakanties liggen binnen het nieuwe schooljaar'
);
select is(
  (select van from public.schoolvakantie
   where schooljaar_id = '00000000-0000-4000-8000-000000000b01' and naam = 'Herfstvakantie'),
  '2027-10-17'::date,
  'Vakantiedatums schuiven mee met het verschil in startdatum (365 dagen)'
);
select is_empty(
  $$select 1 from public.toewijzing where schooljaar_id = '00000000-0000-4000-8000-000000000b01'$$,
  'Toewijzingen worden niet gekopieerd (SPEC §11)'
);
select matches(
  tests.probeer('coordinator', $$select public.schooljaar_configuratie_kopieren(
    (select id from public.schooljaar where naam = '2026-2027'), '00000000-0000-4000-8000-000000000b01')$$),
  '^fout:23505', 'Kopiëren naar een schooljaar met configuratie wordt geweigerd'
);
select matches(
  tests.probeer('coordinator', $$select public.schooljaar_configuratie_kopieren(
    '00000000-0000-4000-8000-000000000b01', '00000000-0000-4000-8000-000000000b01')$$),
  '^fout:22023', 'Van en naar moeten verschillende schooljaren zijn'
);

-- ---------------------------------------------------------------------------
-- E-mailadres van een medewerker met account blijft vast
-- ---------------------------------------------------------------------------

select matches(
  tests.probeer('coordinator', $$update public.medewerker set email = 'ander@voorbeeld.test'
    where id = tests.mw('lmc_b')$$),
  '^fout:23514', 'E-mailadres van een medewerker met account kan niet worden gewijzigd'
);
select matches(
  tests.probeer('coordinator', $$update public.medewerker set email = 'nieuw-adres@voorbeeld.test'
    where email = 'kees.vandijk@voorbeeld.test'$$),
  '^rijen:1$', 'E-mailadres van een medewerker zonder account kan wel worden gewijzigd'
);
select matches(
  tests.probeer('coordinator', $$update public.medewerker set voornaam = 'Anders'
    where id = tests.mw('lmc_b')$$),
  '^rijen:1$', 'Andere gegevens van een medewerker met account kunnen wel worden gewijzigd'
);

select * from finish();
rollback;
