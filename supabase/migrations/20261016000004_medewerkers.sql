-- Medewerkergegevens: contracten, vakantie-uren, beschikbaarheid en aliassen (SPEC §4).
-- Lezen: eigen gegevens, of alles voor coordinator/manager/beheerder.
-- Beheren: coordinator, manager, beheerder (SPEC §6).

-- geldig_tot leeg betekent: doorlopend. Periodes van één medewerker overlappen niet.
create table public.contract (
  id uuid primary key default gen_random_uuid(),
  medewerker_id uuid not null references public.medewerker (id) on delete cascade,
  uren_per_week numeric not null check (uren_per_week > 0 and uren_per_week <= 40),
  geldig_van date not null,
  geldig_tot date check (geldig_tot >= geldig_van),
  constraint contract_geen_overlap exclude using gist (
    medewerker_id with =,
    daterange(geldig_van, geldig_tot, '[]') with &&
  )
);

-- HR levert vakantie-uren per kalenderjaar; de omrekening naar schooljaar volgt in fase 3.
create table public.vakantie_uren (
  id uuid primary key default gen_random_uuid(),
  medewerker_id uuid not null references public.medewerker (id) on delete cascade,
  kalenderjaar integer not null check (kalenderjaar between 2000 and 2100),
  uren numeric not null check (uren >= 0),
  unique (medewerker_id, kalenderjaar)
);

-- Dataminimalisatie: er is bewust GEEN veld voor de reden van afwezigheid.
create table public.niet_beschikbaar (
  id uuid primary key default gen_random_uuid(),
  medewerker_id uuid not null references public.medewerker (id) on delete cascade,
  van date not null,
  tot date not null check (tot >= van),
  beschikbaarheidspercentage numeric not null
    check (beschikbaarheidspercentage between 0 and 100),
  constraint niet_beschikbaar_geen_overlap exclude using gist (
    medewerker_id with =,
    daterange(van, tot, '[]') with &&
  )
);

comment on table public.niet_beschikbaar is
  'Periodes van verminderde beschikbaarheid. Nooit een reden vastleggen (SPEC §1).';

-- Matching gebeurt op de genormaliseerde vorm (SPEC §4).
create table public.medewerker_alias (
  id uuid primary key default gen_random_uuid(),
  medewerker_id uuid not null references public.medewerker (id) on delete cascade,
  bron public.alias_bron not null,
  alias text not null check (length(btrim(alias)) between 1 and 200),
  alias_genormaliseerd text generated always as (private.normaliseer_naam(alias)) stored,
  unique (bron, alias_genormaliseerd)
);

create index medewerker_alias_medewerker_idx on public.medewerker_alias (medewerker_id);

-- Rechten
do $$
declare
  v_tabel text;
begin
  foreach v_tabel in array array[
    'public.contract', 'public.vakantie_uren', 'public.niet_beschikbaar'
  ] loop
    perform private.beveilig_tabel(
      v_tabel::regclass,
      'medewerker_id = (select private.eigen_medewerker_id()) or '
        || private.expr_rollen('{coordinator,manager,beheerder}'),
      private.expr_rollen('{coordinator,manager,beheerder}')
    );
  end loop;
end
$$;

-- Aliassen zijn alleen voor de import nodig; de lmc ziet ze niet.
select private.beveilig_tabel(
  'public.medewerker_alias',
  private.expr_rollen('{coordinator,manager,beheerder}'),
  private.expr_rollen('{coordinator,manager,beheerder}')
);
