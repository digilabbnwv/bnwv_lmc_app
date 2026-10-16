-- MATT-import (SPEC §8): concept opslaan, definitief maken, terugdraaien, verwerpen,
-- en de view gerealiseerd. De Edge Function matt-import controleert en parseert het
-- bestand; de database matcht, slaat op en beslist over rechten.

-- ---------------------------------------------------------------------------
-- Niet-gematchte namen (alleen zolang een import concept is)
-- ---------------------------------------------------------------------------

-- Bewust een aparte tabel zonder audit-trigger: anders komen deze namen in het
-- (append-only) auditlog. Bij definitief maken wordt de tabel voor die import geleegd.
create table public.matt_import_niet_gematcht (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.matt_import (id) on delete cascade,
  naam text not null check (length(naam) <= 200),
  aantal integer not null check (aantal > 0),
  uren numeric not null
);

create index matt_import_niet_gematcht_import_idx on public.matt_import_niet_gematcht (import_id);

select private.beveilig_tabel(
  'public.matt_import_niet_gematcht',
  private.expr_rollen('{coordinator,manager,beheerder}'),
  null,
  false
);

-- ---------------------------------------------------------------------------
-- Hulpfuncties
-- ---------------------------------------------------------------------------

-- Mag de aanroeper importeren? Coordinator, manager of beheerder op aal2.
create function public.mag_matt_importeren()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.heeft_een_rol('{coordinator,manager,beheerder}')
$$;

-- Telt een import mee? Alleen definitieve imports. Geeft alleen een ja/nee terug, zodat
-- de view gerealiseerd ook werkt voor een lmc (die matt_import zelf niet mag lezen).
create function private.import_is_definitief(p_import_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.matt_import i where i.id = p_import_id and i.status = 'definitief'
  )
$$;

revoke execute on function public.mag_matt_importeren(), private.import_is_definitief(uuid)
from public, anon;
grant execute on function public.mag_matt_importeren(), private.import_is_definitief(uuid)
to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Concept opslaan
-- ---------------------------------------------------------------------------

-- p_regels: array van objecten met medewerker, projectnummer, projectnaam, artikelcode,
-- datum (jjjj-mm-dd), uren, uren_open, omschrijving. De Edge Function heeft het bestand,
-- de subtotalen en de periode al gecontroleerd; hier volgen matchen en opslaan.
-- Geeft het import-ID en de voorvertoning terug.
create function public.matt_import_concept_opslaan(
  p_periode_van date,
  p_periode_tot date,
  p_regels jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_import uuid;
  v_resultaat jsonb;
begin
  if not private.heeft_een_rol('{coordinator,manager,beheerder}') then
    raise exception 'Geen recht om MATT-exports te importeren.' using errcode = '42501';
  end if;
  if p_periode_van is null or p_periode_tot is null or p_periode_tot < p_periode_van then
    raise exception 'Ongeldige periode.' using errcode = '22023';
  end if;
  if jsonb_typeof(p_regels) is distinct from 'array' then
    raise exception 'Ongeldige regels.' using errcode = '22023';
  end if;

  -- Oude, nooit afgeronde concepten opruimen (geautomatiseerd in versie 2).
  delete from public.matt_import where status = 'concept' and tijdstip < now() - interval '24 hours';

  drop table if exists pg_temp.matt_regels;
  create temporary table matt_regels on commit drop as
  select
    gen_random_uuid() as id,
    btrim(r.medewerker) as medewerker,
    private.normaliseer_naam(r.medewerker) as genormaliseerd,
    btrim(r.projectnummer) as projectnummer,
    btrim(r.projectnaam) as projectnaam,
    btrim(r.artikelcode) as artikelcode,
    r.datum,
    r.uren,
    r.uren_open,
    nullif(btrim(r.omschrijving), '') as omschrijving,
    null::uuid as medewerker_id,
    null::uuid as matt_project_id,
    null::public.boeking_categorie as categorie
  from jsonb_to_recordset(p_regels) as r (
    medewerker text,
    projectnummer text,
    projectnaam text,
    artikelcode text,
    datum date,
    uren numeric,
    uren_open numeric,
    omschrijving text
  );

  if exists (
    select 1 from pg_temp.matt_regels
    where medewerker is null or projectnummer is null or artikelcode is null or datum is null
      or uren is null or uren_open is null
  ) then
    raise exception 'Een of meer regels zijn onvolledig.' using errcode = '22023';
  end if;
  if exists (
    select 1 from pg_temp.matt_regels where datum < p_periode_van or datum > p_periode_tot
  ) then
    raise exception 'Er zijn boekingen buiten de opgegeven periode.' using errcode = '22023';
  end if;

  -- Projecten: onbekende nummers aanmaken als "niet gekoppeld"; naam bijwerken.
  -- Er wordt alleen op projectnummer gematcht, nooit op naam.
  insert into public.matt_project (projectnummer, naam_laatst_gezien)
  select distinct on (r.projectnummer) r.projectnummer, r.projectnaam
  from pg_temp.matt_regels r
  order by r.projectnummer
  on conflict (projectnummer) do update set naam_laatst_gezien = excluded.naam_laatst_gezien;

  update pg_temp.matt_regels r set
    medewerker_id = (
      select a.medewerker_id from public.medewerker_alias a
      where a.bron = 'matt' and a.alias_genormaliseerd = r.genormaliseerd
    ),
    matt_project_id = (select p.id from public.matt_project p where p.projectnummer = r.projectnummer),
    categorie = (select m.categorie from public.matt_artikel_mapping m where m.artikelcode = r.artikelcode);

  insert into public.matt_import (uitgevoerd_door, periode_van, periode_tot, status)
  values (auth.uid(), p_periode_van, p_periode_tot, 'concept')
  returning id into v_import;

  -- Alleen boekingen van gematchte medewerkers worden opgeslagen.
  insert into public.boeking (id, import_id, medewerker_id, matt_project_id, artikelcode, categorie,
    datum, uren, uren_open)
  select r.id, v_import, r.medewerker_id, r.matt_project_id, r.artikelcode, r.categorie,
    r.datum, r.uren, r.uren_open
  from pg_temp.matt_regels r
  where r.medewerker_id is not null;

  insert into public.boeking_omschrijving (boeking_id, omschrijving)
  select r.id, left(r.omschrijving, 2000)
  from pg_temp.matt_regels r
  where r.medewerker_id is not null and r.omschrijving is not null;

  insert into public.matt_import_niet_gematcht (import_id, naam, aantal, uren)
  select v_import, left(min(r.medewerker), 200), count(*), sum(r.uren)
  from pg_temp.matt_regels r
  where r.medewerker_id is null
  group by r.genormaliseerd;

  select jsonb_build_object(
    'import_id', v_import,
    'totaal', (select jsonb_build_object('aantal', count(*), 'uren', coalesce(sum(uren), 0)) from pg_temp.matt_regels),
    'opgeslagen', (
      select jsonb_build_object('aantal', count(*), 'uren', coalesce(sum(uren), 0))
      from pg_temp.matt_regels where medewerker_id is not null
    ),
    'medewerkers', coalesce((
      select jsonb_agg(jsonb_build_object('medewerker_id', x.medewerker_id, 'aantal', x.aantal, 'uren', x.uren)
        order by x.medewerker_id)
      from (
        select medewerker_id, count(*) as aantal, sum(uren) as uren
        from pg_temp.matt_regels where medewerker_id is not null group by medewerker_id
      ) x
    ), '[]'::jsonb),
    'niet_gematcht_aantal', (select count(*) from pg_temp.matt_regels where medewerker_id is null),
    'niet_gekoppelde_projecten', coalesce((
      select jsonb_agg(jsonb_build_object('projectnummer', x.projectnummer, 'naam', x.naam, 'uren', x.uren)
        order by x.projectnummer)
      from (
        select r.projectnummer, min(r.projectnaam) as naam, sum(r.uren) as uren
        from pg_temp.matt_regels r
        join public.matt_project p on p.id = r.matt_project_id
        where p.werkpakket_id is null and not p.genegeerd and r.medewerker_id is not null
        group by r.projectnummer
      ) x
    ), '[]'::jsonb),
    'onbekende_artikelcodes', coalesce((
      select jsonb_agg(jsonb_build_object('artikelcode', x.artikelcode, 'aantal', x.aantal)
        order by x.artikelcode)
      from (
        select artikelcode, count(*) as aantal from pg_temp.matt_regels
        where categorie is null group by artikelcode
      ) x
    ), '[]'::jsonb)
  ) into v_resultaat;

  -- De aantallen bevatten geen namen, alleen medewerker-ID's en projectnummers.
  update public.matt_import
  set aantallen = v_resultaat - 'import_id',
    totaal_uren = (v_resultaat -> 'opgeslagen' ->> 'uren')::numeric
  where id = v_import;

  return v_resultaat;
end
$$;

-- ---------------------------------------------------------------------------
-- Definitief maken, terugdraaien en verwerpen
-- ---------------------------------------------------------------------------

-- Vervangt in één transactie alle bestaande definitieve boekingen van de gematchte
-- medewerkers binnen de periode door die van deze import. Een tweede import van
-- hetzelfde bestand levert daardoor nooit dubbele boekingen op (SPEC §8).
create function public.matt_import_definitief_maken(p_import_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_import public.matt_import;
  v_vervangen integer;
  v_nieuw integer;
begin
  if not private.heeft_een_rol('{coordinator,manager,beheerder}') then
    raise exception 'Geen recht om MATT-exports te importeren.' using errcode = '42501';
  end if;
  select * into v_import from public.matt_import where id = p_import_id for update;
  if v_import.id is null then
    raise exception 'Onbekende import.' using errcode = 'P0002';
  end if;
  if v_import.status <> 'concept' then
    raise exception 'Alleen een concept kan definitief worden gemaakt.' using errcode = '22023';
  end if;

  delete from public.boeking b
  using public.matt_import i
  where b.import_id = i.id
    and i.status = 'definitief'
    and i.id <> p_import_id
    and b.datum between v_import.periode_van and v_import.periode_tot
    and b.medewerker_id in (select n.medewerker_id from public.boeking n where n.import_id = p_import_id);
  get diagnostics v_vervangen = row_count;

  select count(*) into v_nieuw from public.boeking where import_id = p_import_id;

  -- Niet-gematchte namen zijn na de voorvertoning niet meer nodig.
  delete from public.matt_import_niet_gematcht where import_id = p_import_id;

  update public.matt_import set status = 'definitief' where id = p_import_id;

  perform private.log_actie(
    'matt_import_definitief', 'matt_import', p_import_id::text, null,
    jsonb_build_object(
      'periode_van', v_import.periode_van, 'periode_tot', v_import.periode_tot,
      'vervangen', v_vervangen, 'nieuw', v_nieuw
    )
  );
  return jsonb_build_object('vervangen', v_vervangen, 'nieuw', v_nieuw);
end
$$;

-- Draait een definitieve import in zijn geheel terug: de boekingen (en omschrijvingen)
-- worden verwijderd; de import blijft met zijn aantallen in de historie.
-- Boekingen die deze import eerder heeft vervangen, komen niet terug.
create function public.matt_import_terugdraaien(p_import_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.import_status;
  v_verwijderd integer;
begin
  if not private.heeft_een_rol('{coordinator,manager,beheerder}') then
    raise exception 'Geen recht om MATT-imports terug te draaien.' using errcode = '42501';
  end if;
  select status into v_status from public.matt_import where id = p_import_id for update;
  if v_status is null then
    raise exception 'Onbekende import.' using errcode = 'P0002';
  end if;
  if v_status <> 'definitief' then
    raise exception 'Alleen een definitieve import kan worden teruggedraaid.' using errcode = '22023';
  end if;

  delete from public.boeking where import_id = p_import_id;
  get diagnostics v_verwijderd = row_count;
  update public.matt_import set status = 'teruggedraaid' where id = p_import_id;

  perform private.log_actie(
    'matt_import_teruggedraaid', 'matt_import', p_import_id::text, null,
    jsonb_build_object('verwijderd', v_verwijderd)
  );
  return jsonb_build_object('verwijderd', v_verwijderd);
end
$$;

-- Verwijdert een concept dat niet definitief wordt (met boekingen en namen).
create function public.matt_import_verwerpen(p_import_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.import_status;
begin
  if not private.heeft_een_rol('{coordinator,manager,beheerder}') then
    raise exception 'Geen recht om MATT-imports te verwerpen.' using errcode = '42501';
  end if;
  select status into v_status from public.matt_import where id = p_import_id for update;
  if v_status is null then
    raise exception 'Onbekende import.' using errcode = 'P0002';
  end if;
  if v_status <> 'concept' then
    raise exception 'Alleen een concept kan worden verworpen.' using errcode = '22023';
  end if;
  delete from public.matt_import where id = p_import_id;
end
$$;

revoke execute on function
  public.matt_import_concept_opslaan(date, date, jsonb),
  public.matt_import_definitief_maken(uuid),
  public.matt_import_terugdraaien(uuid),
  public.matt_import_verwerpen(uuid)
from public, anon;

grant execute on function
  public.matt_import_concept_opslaan(date, date, jsonb),
  public.matt_import_definitief_maken(uuid),
  public.matt_import_terugdraaien(uuid),
  public.matt_import_verwerpen(uuid)
to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Gerealiseerd
-- ---------------------------------------------------------------------------

-- Gerealiseerde uren: boekingen uit definitieve imports, zonder genegeerde projecten.
-- werkpakket_id leeg = (nog) niet gekoppeld MATT-project. Basis voor fase 6.
create view public.gerealiseerd
with (security_invoker = true)
as
select
  b.id as boeking_id,
  b.medewerker_id,
  b.datum,
  b.uren,
  b.uren_open,
  b.categorie,
  b.artikelcode,
  b.matt_project_id,
  p.projectnummer,
  p.werkpakket_id
from public.boeking b
join public.matt_project p on p.id = b.matt_project_id and not p.genegeerd
where private.import_is_definitief(b.import_id);

revoke all on table public.gerealiseerd from public, anon;
grant select on table public.gerealiseerd to authenticated, service_role;
