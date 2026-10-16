-- Configuratie: schooljaren, vakanties, feestdagen, staffel, opslagfactoren,
-- instellingen en de MATT-artikelmapping (SPEC §4).
-- Lezen: iedereen met toegang. Beheren: coordinator, manager, beheerder (SPEC §6).

create table public.schooljaar (
  id uuid primary key default gen_random_uuid(),
  naam text not null unique check (naam ~ '^\d{4}-\d{4}$'),
  startdatum date not null,
  einddatum date not null,
  check (einddatum > startdatum),
  constraint schooljaar_geen_overlap
    exclude using gist (daterange(startdatum, einddatum, '[]') with &&)
);

create table public.schoolvakantie (
  id uuid primary key default gen_random_uuid(),
  schooljaar_id uuid not null references public.schooljaar (id) on delete cascade,
  naam text not null check (length(btrim(naam)) between 1 and 100),
  van date not null,
  tot date not null,
  check (tot >= van)
);

create index schoolvakantie_schooljaar_idx on public.schoolvakantie (schooljaar_id);

-- Een vakantie ligt binnen het schooljaar waar hij bij hoort. Een zomervakantie
-- die over de jaargrens loopt, wordt dus in twee delen vastgelegd.
create function private.controleer_vakantie_binnen_schooljaar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.schooljaar s
    where s.id = new.schooljaar_id and new.van >= s.startdatum and new.tot <= s.einddatum
  ) then
    raise exception 'De vakantie valt niet binnen het schooljaar.' using errcode = '23514';
  end if;
  return new;
end
$$;

revoke execute on function private.controleer_vakantie_binnen_schooljaar()
from public, anon, authenticated;

create trigger binnen_schooljaar
  before insert or update on public.schoolvakantie
  for each row execute function private.controleer_vakantie_binnen_schooljaar();

create table public.feestdag (
  id uuid primary key default gen_random_uuid(),
  datum date not null unique,
  naam text not null check (length(btrim(naam)) between 1 and 100)
);

-- leerlingen_max leeg betekent: geen bovengrens.
create table public.staffel (
  id uuid primary key default gen_random_uuid(),
  schooljaar_id uuid not null references public.schooljaar (id) on delete cascade,
  schooltype public.schooltype not null,
  leerlingen_min integer not null check (leerlingen_min >= 0),
  leerlingen_max integer check (leerlingen_max >= leerlingen_min),
  uren numeric not null check (uren >= 0),
  constraint staffel_geen_overlap exclude using gist (
    schooljaar_id with =,
    schooltype with =,
    int4range(leerlingen_min, leerlingen_max, '[]') with &&
  )
);

create table public.opslagfactor (
  id uuid primary key default gen_random_uuid(),
  schooljaar_id uuid not null references public.schooljaar (id) on delete cascade,
  schooltype public.schooltype not null,
  factor numeric not null check (factor > 0),
  bevestigd boolean not null default false,
  unique (schooljaar_id, schooltype)
);

comment on column public.opslagfactor.bevestigd is
  'false = nog te bevestigen (seed: 2,0 voor alle typen).';

-- Sleutel-waarde met ingangsdatum. De waarde die geldt op datum D is die met de
-- laatste ingangsdatum <= D.
create table public.instelling (
  id uuid primary key default gen_random_uuid(),
  sleutel text not null check (
    sleutel in (
      'overhead_percentage', 'grens_vol', 'grens_boven_capaciteit', 'toegestaan_email_domein'
    )
  ),
  waarde text not null,
  ingangsdatum date not null,
  unique (sleutel, ingangsdatum),
  check (
    case
      when sleutel = 'toegestaan_email_domein'
        then waarde ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$'
      when waarde ~ '^\d{1,4}(\.\d+)?$'
        then waarde::numeric between 0 and 1000
      else false
    end
  )
);

create table public.matt_artikel_mapping (
  id uuid primary key default gen_random_uuid(),
  artikelcode text not null unique check (artikelcode ~ '^\S+$'),
  categorie public.boeking_categorie not null
);

-- Rechten
do $$
declare
  v_tabel text;
begin
  foreach v_tabel in array array[
    'public.schooljaar', 'public.schoolvakantie', 'public.feestdag', 'public.staffel',
    'public.opslagfactor', 'public.instelling', 'public.matt_artikel_mapping'
  ] loop
    perform private.beveilig_tabel(
      v_tabel::regclass,
      '(select private.heeft_toegang())',
      private.expr_rollen('{coordinator,manager,beheerder}')
    );
  end loop;
end
$$;
