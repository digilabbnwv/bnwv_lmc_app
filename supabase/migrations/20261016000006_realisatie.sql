-- Realisatie: MATT-imports en boekingen (SPEC §4, §8).
-- Schrijven gebeurt uitsluitend via RPC-functies van de import (fase 5); er zijn
-- daarom geen insert-, update- of delete-policies.

create table public.matt_import (
  id uuid primary key default gen_random_uuid(),
  uitgevoerd_door uuid references auth.users (id) on delete set null,
  tijdstip timestamptz not null default now(),
  periode_van date not null,
  periode_tot date not null check (periode_tot >= periode_van),
  -- Aantallen voor de voorvertoning: per medewerker, niet-gematchte namen, onbekende projecten.
  aantallen jsonb not null default '{}'::jsonb,
  totaal_uren numeric not null default 0,
  status public.import_status not null default 'concept'
);

create index matt_import_status_idx on public.matt_import (status);

create table public.boeking (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.matt_import (id) on delete cascade,
  medewerker_id uuid not null references public.medewerker (id) on delete restrict,
  matt_project_id uuid not null references public.matt_project (id) on delete restrict,
  artikelcode text not null check (artikelcode ~ '^\S{1,50}$'),
  -- Leeg als de artikelcode (nog) niet in matt_artikel_mapping staat.
  categorie public.boeking_categorie,
  datum date not null,
  -- uren = verwerkt + uren_open (SPEC §8).
  uren numeric not null,
  uren_open numeric not null default 0
);

create index boeking_medewerker_datum_idx on public.boeking (medewerker_id, datum);
create index boeking_import_idx on public.boeking (import_id);
create index boeking_project_idx on public.boeking (matt_project_id);

-- Aparte tabel, zodat de omschrijving voor de manager afgeschermd blijft (SPEC §6).
create table public.boeking_omschrijving (
  boeking_id uuid primary key references public.boeking (id) on delete cascade,
  omschrijving text not null check (length(omschrijving) <= 2000)
);

-- Rechten (SPEC §6)
-- Imports: inzien door coordinator, manager, beheerder. Audit gebeurt per import
-- (rij-audit op matt_import), niet per boeking.
select private.beveilig_tabel(
  'public.matt_import',
  private.expr_rollen('{coordinator,manager,beheerder}'),
  null
);

-- Boekingen: eigen boekingen, of alles voor coordinator/manager/beheerder.
-- Geen rij-audit: een import van duizenden regels wordt als geheel gelogd.
select private.beveilig_tabel(
  'public.boeking',
  'medewerker_id = (select private.eigen_medewerker_id()) or '
    || private.expr_rollen('{coordinator,manager,beheerder}'),
  null,
  false
);

-- Omschrijvingen: rechtstreeks ALLEEN de eigen omschrijvingen, voor elke rol.
-- Omschrijvingen van anderen lopen via public.boeking_details_van_ander().
-- Geen rij-audit: anders zou de manager ze via het auditlog alsnog kunnen lezen.
select private.beveilig_tabel(
  'public.boeking_omschrijving',
  'exists (select 1 from public.boeking b where b.id = boeking_id'
    || ' and b.medewerker_id = (select private.eigen_medewerker_id()))',
  null,
  false
);

-- Boekingdetails (inclusief omschrijving) van een andere medewerker. Alleen voor
-- coordinator en beheerder; elke opvraging komt in het auditlog (SPEC §6).
create function public.boeking_details_van_ander(
  p_medewerker_id uuid,
  p_van date,
  p_tot date
)
returns table (
  boeking_id uuid,
  datum date,
  matt_project_id uuid,
  artikelcode text,
  categorie public.boeking_categorie,
  uren numeric,
  uren_open numeric,
  omschrijving text
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_aantal integer;
begin
  if not private.heeft_een_rol('{coordinator,beheerder}') then
    raise exception 'Geen toegang tot boekingdetails van anderen.' using errcode = '42501';
  end if;
  if p_medewerker_id is null or p_van is null or p_tot is null or p_tot < p_van then
    raise exception 'Ongeldige medewerker of periode.' using errcode = '22023';
  end if;

  select count(*) into v_aantal
  from public.boeking b
  join public.matt_import i on i.id = b.import_id
  where b.medewerker_id = p_medewerker_id
    and b.datum between p_van and p_tot
    and i.status <> 'teruggedraaid';

  perform private.log_actie(
    'boeking_details_ingezien',
    'boeking_omschrijving',
    p_medewerker_id::text,
    null,
    jsonb_build_object(
      'medewerker_id', p_medewerker_id, 'van', p_van, 'tot', p_tot, 'aantal', v_aantal
    )
  );

  return query
    select b.id, b.datum, b.matt_project_id, b.artikelcode, b.categorie, b.uren, b.uren_open,
      o.omschrijving
    from public.boeking b
    join public.matt_import i on i.id = b.import_id
    left join public.boeking_omschrijving o on o.boeking_id = b.id
    where b.medewerker_id = p_medewerker_id
      and b.datum between p_van and p_tot
      and i.status <> 'teruggedraaid'
    order by b.datum, b.id;
end
$$;

revoke execute on function public.boeking_details_van_ander(uuid, date, date)
from public, anon;
grant execute on function public.boeking_details_van_ander(uuid, date, date) to authenticated;
