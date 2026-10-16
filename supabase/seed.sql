-- Seed met uitsluitend FICTIEVE gegevens (SPEC §1). Alleen voor lokaal en het testproject.
-- Nooit echte namen van medewerkers of echte MATT-exports opnemen.
--
-- De medewerkers komen overeen met de namen in fixtures/matt-export-synthetisch.xml.
-- "Testpersoon Onbekend" en project 999 staan er bewust NIET in: die testen de
-- niet-gematchte medewerker en het onbekende projectnummer (SPEC §8).
-- Er worden geen auth-gebruikers of wachtwoorden aangemaakt.

-- ---------------------------------------------------------------------------
-- Configuratie
-- ---------------------------------------------------------------------------

insert into public.schooljaar (naam, startdatum, einddatum) values
  ('2025-2026', '2025-08-01', '2026-07-31'),
  ('2026-2027', '2026-08-01', '2027-07-31');

-- Schoolvakanties: indicatief, nog te controleren tegen de officiële regio-indeling.
-- Een zomervakantie over de jaargrens staat in twee delen.
insert into public.schoolvakantie (schooljaar_id, naam, van, tot)
select s.id, v.naam, v.van::date, v.tot::date
from (values
  ('2025-2026', 'Zomervakantie (deel)', '2025-08-01', '2025-08-31'),
  ('2025-2026', 'Herfstvakantie', '2025-10-18', '2025-10-26'),
  ('2025-2026', 'Kerstvakantie', '2025-12-20', '2026-01-04'),
  ('2025-2026', 'Voorjaarsvakantie', '2026-02-14', '2026-02-22'),
  ('2025-2026', 'Meivakantie', '2026-04-25', '2026-05-03'),
  ('2025-2026', 'Zomervakantie (deel)', '2026-07-18', '2026-07-31'),
  ('2026-2027', 'Zomervakantie (deel)', '2026-08-01', '2026-08-30'),
  ('2026-2027', 'Herfstvakantie', '2026-10-17', '2026-10-25'),
  ('2026-2027', 'Kerstvakantie', '2026-12-19', '2027-01-03'),
  ('2026-2027', 'Voorjaarsvakantie', '2027-02-20', '2027-02-28'),
  ('2026-2027', 'Meivakantie', '2027-04-24', '2027-05-02'),
  ('2026-2027', 'Zomervakantie (deel)', '2027-07-17', '2027-07-31')
) as v (schooljaar, naam, van, tot)
join public.schooljaar s on s.naam = v.schooljaar;

-- Feestdagen. Voor 2026-2027 exact de testfeestdagen uit SPEC §5.
insert into public.feestdag (datum, naam) values
  ('2025-12-25', 'Eerste kerstdag'),
  ('2025-12-26', 'Tweede kerstdag'),
  ('2026-01-01', 'Nieuwjaarsdag'),
  ('2026-04-06', 'Tweede paasdag'),
  ('2026-04-27', 'Koningsdag'),
  ('2026-05-14', 'Hemelvaartsdag'),
  ('2026-05-25', 'Tweede pinksterdag'),
  ('2026-12-25', 'Eerste kerstdag'),
  ('2026-12-26', 'Tweede kerstdag'),
  ('2027-01-01', 'Nieuwjaarsdag'),
  ('2027-03-29', 'Tweede paasdag'),
  ('2027-04-27', 'Koningsdag'),
  ('2027-05-06', 'Hemelvaartsdag'),
  ('2027-05-17', 'Tweede pinksterdag');

-- Fictieve staffel (uren op jaarbasis). Leeg maximum = geen bovengrens.
insert into public.staffel (schooljaar_id, schooltype, leerlingen_min, leerlingen_max, uren)
select s.id, v.schooltype::public.schooltype, v.min, v.max, v.uren
from (values
  ('PO', 0, 100, 20), ('PO', 101, 200, 30), ('PO', 201, 400, 50), ('PO', 401, null, 70),
  ('VO', 0, 500, 40), ('VO', 501, 1000, 60), ('VO', 1001, null, 80),
  ('BoekStart', 0, null, 10)
) as v (schooltype, min, max, uren)
cross join public.schooljaar s;

-- Opslagfactor 2,0 voor alle typen, nog te bevestigen (SPEC §4).
insert into public.opslagfactor (schooljaar_id, schooltype, factor, bevestigd)
select s.id, t.schooltype, 2.0, false
from public.schooljaar s
cross join unnest(enum_range(null::public.schooltype)) as t (schooltype);

insert into public.instelling (sleutel, waarde, ingangsdatum) values
  ('overhead_percentage', '15', '2025-08-01'),
  ('grens_vol', '85', '2025-08-01'),
  ('grens_boven_capaciteit', '100', '2025-08-01'),
  ('toegestaan_email_domein', 'voorbeeld.test', '2025-08-01');

insert into public.matt_artikel_mapping (artikelcode, categorie) values
  ('10', 'uitvoering'),
  ('11', 'voorbereiding_afronding'),
  ('12', 'relatiebeheer');

-- ---------------------------------------------------------------------------
-- Medewerkers (fictief)
-- ---------------------------------------------------------------------------

insert into public.medewerker (voornaam, achternaam, email) values
  ('Sanne', 'de Vries', 'sanne.devries@voorbeeld.test'),
  ('Lotte', 'Visser - de Boer', 'lotte.visser@voorbeeld.test'),
  ('Pieter', 'Jansen - Bakker', 'pieter.jansen@voorbeeld.test'),
  ('Fatima', 'el Amrani', 'fatima.elamrani@voorbeeld.test'),
  ('Kees', 'van Dijk', 'kees.vandijk@voorbeeld.test');

-- Aliassen zoals ze in de MATT-export staan.
insert into public.medewerker_alias (medewerker_id, bron, alias)
select m.id, 'matt', m.voornaam || ' ' || m.achternaam
from public.medewerker m;

insert into public.contract (medewerker_id, uren_per_week, geldig_van, geldig_tot)
select m.id, v.uren, v.van::date, v.tot::date
from (values
  ('sanne.devries@voorbeeld.test', 24, '2025-08-01', '2026-12-31'),
  ('sanne.devries@voorbeeld.test', 28, '2027-01-01', null),
  ('lotte.visser@voorbeeld.test', 28, '2025-08-01', null),
  ('pieter.jansen@voorbeeld.test', 20, '2025-08-01', null),
  ('fatima.elamrani@voorbeeld.test', 32, '2025-08-01', null),
  ('kees.vandijk@voorbeeld.test', 16, '2025-08-01', null)
) as v (email, uren, van, tot)
join public.medewerker m on m.email = v.email;

insert into public.vakantie_uren (medewerker_id, kalenderjaar, uren)
select m.id, j.jaar, round(c.uren_per_week * 6.25, 1)
from public.medewerker m
join public.contract c on c.medewerker_id = m.id and c.geldig_van = '2025-08-01'
cross join (values (2025), (2026), (2027)) as j (jaar);

insert into public.niet_beschikbaar (medewerker_id, van, tot, beschikbaarheidspercentage)
select m.id, '2027-03-01', '2027-03-12', 50
from public.medewerker m
where m.email = 'kees.vandijk@voorbeeld.test';

-- ---------------------------------------------------------------------------
-- Werk (fictief; projectnummers volgen de synthetische fixture)
-- ---------------------------------------------------------------------------

insert into public.activiteittype
  (naam, normuren_uitvoering, normuren_voorbereiding, normuren_afronding)
values
  ('Digilab', 2, 1, 0.5),
  ('Boekjes & Babbels', 1.5, 0.5, 0.25),
  ('Peuterbieb', 1, 0.5, 0.25);

-- Scholen
with nieuw as (
  insert into public.werkpakket (soort, naam, vestiging)
  values
    ('school', 'De Zonnebloem', 'HAR'),
    ('school', 'De Regenboog', 'ERM'),
    ('school', 'Het Kompas', 'NUN'),
    ('school', 'De Wilgen', 'PUT'),
    ('school', 'Sterrenwacht College', 'HAR'),
    ('school', 'Kinderopvang Kikkerland', 'HAR')
  returning id, naam
)
insert into public.school (werkpakket_id, schooltype, adres, postcode, plaats)
select n.id, v.schooltype::public.schooltype, v.adres, v.postcode, v.plaats
from nieuw n
join (values
  ('De Zonnebloem', 'PO', 'Voorbeeldstraat 1', '1234 AB', 'Harderwijk'),
  ('De Regenboog', 'PO', 'Voorbeeldlaan 2', '1234 AC', 'Ermelo'),
  ('Het Kompas', 'PO', 'Voorbeeldweg 3', '1234 AD', 'Nunspeet'),
  ('De Wilgen', 'PO', 'Voorbeeldplein 4', '1234 AE', 'Putten'),
  ('Sterrenwacht College', 'VO', 'Voorbeeldsingel 5', '1234 AF', 'Harderwijk'),
  ('Kinderopvang Kikkerland', 'BoekStart', 'Voorbeeldhof 6', '1234 AG', 'Harderwijk')
) as v (naam, schooltype, adres, postcode, plaats) on v.naam = n.naam;

insert into public.school_schooljaar (school_id, schooljaar_id, aantal_leerlingen)
select sc.werkpakket_id, sj.id, v.leerlingen
from (values
  ('De Zonnebloem', 250), ('De Regenboog', 180), ('Het Kompas', 90), ('De Wilgen', 420),
  ('Sterrenwacht College', 750), ('Kinderopvang Kikkerland', 40)
) as v (naam, leerlingen)
join public.werkpakket w on w.naam = v.naam and w.soort = 'school'
join public.school sc on sc.werkpakket_id = w.id
cross join public.schooljaar sj;

-- Activiteiten en projecten
insert into public.werkpakket (soort, naam, vestiging, activiteittype_id)
select v.soort::public.werkpakket_soort, v.naam, v.vestiging::public.vestiging, a.id
from (values
  ('activiteit', 'Boekjes & Babbels Ermelo', 'ERM', 'Boekjes & Babbels'),
  ('activiteit', 'Boekjes & Babbels Harderwijk', 'HAR', 'Boekjes & Babbels'),
  ('activiteit', 'Digilab Nunspeet', 'NUN', 'Digilab'),
  ('activiteit', 'Peuterbieb Harderwijk', 'HAR', 'Peuterbieb'),
  ('project', 'dBos algemeen', 'overig', null),
  ('project', 'Nationale Voorleesdagen', 'overig', null),
  ('project', 'Kinderboekenweek', 'overig', null)
) as v (soort, naam, vestiging, activiteittype)
left join public.activiteittype a on a.naam = v.activiteittype;

-- MATT-projecten, gekoppeld via projectnummer (nooit via projectnaam).
insert into public.matt_project (projectnummer, naam_laatst_gezien, werkpakket_id)
select v.nummer, v.matt_naam, w.id
from (values
  ('901', 'Zonnebloem-HAR', 'De Zonnebloem'),
  ('902', 'De Regenboog - ERM', 'De Regenboog'),
  ('903', 'Het Kompas-NUN', 'Het Kompas'),
  ('904', 'De Wilgen -PUT', 'De Wilgen'),
  ('905', 'Sterrenwacht-VO-HAR', 'Sterrenwacht College'),
  ('906', 'Kikkerland - HAR', 'Kinderopvang Kikkerland'),
  ('950', 'dBos Algemeen', 'dBos algemeen'),
  ('951', 'Boekjes en Babbels - ERM', 'Boekjes & Babbels Ermelo'),
  ('952', 'Boekjes en Babbels - HAR', 'Boekjes & Babbels Harderwijk'),
  ('953', 'DigiLab - NUN', 'Digilab Nunspeet'),
  ('954', 'PeuterBieb - HAR', 'Peuterbieb Harderwijk'),
  ('955', 'Nationale Voorleesdagen', 'Nationale Voorleesdagen'),
  ('956', 'Kinderboekenweek', 'Kinderboekenweek')
) as v (nummer, matt_naam, werkpakket)
join public.werkpakket w on w.naam = v.werkpakket;

-- ---------------------------------------------------------------------------
-- Toewijzingen (fictief)
-- ---------------------------------------------------------------------------

-- Scholen: staffel, verdeeld over de schoolweken. De Zonnebloem wordt gedeeld.
insert into public.toewijzing
  (medewerker_id, werkpakket_id, schooljaar_id, bron, aandeel_percentage, verdeling)
select m.id, w.id, sj.id, 'staffel', v.aandeel, 'schoolweken'
from (values
  ('sanne.devries@voorbeeld.test', 'De Zonnebloem', 60),
  ('lotte.visser@voorbeeld.test', 'De Zonnebloem', 40),
  ('lotte.visser@voorbeeld.test', 'De Regenboog', 100),
  ('fatima.elamrani@voorbeeld.test', 'Het Kompas', 100),
  ('pieter.jansen@voorbeeld.test', 'De Wilgen', 100),
  ('sanne.devries@voorbeeld.test', 'Sterrenwacht College', 100),
  ('pieter.jansen@voorbeeld.test', 'Kinderopvang Kikkerland', 100)
) as v (email, werkpakket, aandeel)
join public.medewerker m on m.email = v.email
join public.werkpakket w on w.naam = v.werkpakket
cross join public.schooljaar sj;

-- Activiteiten: aantal keer x normuren, verdeeld over de schoolweken.
insert into public.toewijzing
  (medewerker_id, werkpakket_id, schooljaar_id, bron, aantal_keer, verdeling)
select m.id, w.id, sj.id, 'norm_x_aantal', v.aantal, 'schoolweken'
from (values
  ('fatima.elamrani@voorbeeld.test', 'Boekjes & Babbels Ermelo', 30),
  ('kees.vandijk@voorbeeld.test', 'Boekjes & Babbels Harderwijk', 30),
  ('kees.vandijk@voorbeeld.test', 'Digilab Nunspeet', 20),
  ('lotte.visser@voorbeeld.test', 'Peuterbieb Harderwijk', 36)
) as v (email, werkpakket, aantal)
join public.medewerker m on m.email = v.email
join public.werkpakket w on w.naam = v.werkpakket
cross join public.schooljaar sj;

-- Projecten: handmatige uren over een looptijd.
insert into public.toewijzing (
  medewerker_id, werkpakket_id, schooljaar_id, bron,
  gepland_uitvoering, gepland_voorbereiding, gepland_afronding,
  verdeling, looptijd_van, looptijd_tot
)
select m.id, w.id, sj.id, 'handmatig', v.uitv, v.voorb, v.afr,
  'looptijd', v.van::date, v.tot::date
from (values
  ('sanne.devries@voorbeeld.test', 'Nationale Voorleesdagen', '2026-2027', 16, 8, 2,
    '2027-01-11', '2027-01-30'),
  ('fatima.elamrani@voorbeeld.test', 'Kinderboekenweek', '2026-2027', 12, 6, 2,
    '2026-09-21', '2026-10-11'),
  ('sanne.devries@voorbeeld.test', 'Nationale Voorleesdagen', '2025-2026', 16, 8, 2,
    '2026-01-12', '2026-01-31')
) as v (email, werkpakket, schooljaar, uitv, voorb, afr, van, tot)
join public.medewerker m on m.email = v.email
join public.werkpakket w on w.naam = v.werkpakket
join public.schooljaar sj on sj.naam = v.schooljaar;
