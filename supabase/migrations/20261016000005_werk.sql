-- Werk: werkpakketten, scholen, activiteittypes, MATT-projecten en toewijzingen (SPEC §4).

create table public.activiteittype (
  id uuid primary key default gen_random_uuid(),
  naam text not null unique check (length(btrim(naam)) between 1 and 100),
  -- Normuren gelden per keer.
  normuren_uitvoering numeric not null default 0 check (normuren_uitvoering >= 0),
  normuren_voorbereiding numeric not null default 0 check (normuren_voorbereiding >= 0),
  normuren_afronding numeric not null default 0 check (normuren_afronding >= 0)
);

-- Gedeelde basis voor alles wat uren kost. Een activiteit verwijst naar het
-- activiteittype waarvan de normuren gelden.
create table public.werkpakket (
  id uuid primary key default gen_random_uuid(),
  soort public.werkpakket_soort not null,
  naam text not null check (length(btrim(naam)) between 1 and 200),
  vestiging public.vestiging not null,
  actief boolean not null default true,
  activiteittype_id uuid references public.activiteittype (id) on delete restrict,
  unique (id, soort),
  check ((soort = 'activiteit') = (activiteittype_id is not null))
);

-- 1-op-1 extensie van een werkpakket met soort 'school'. De samengestelde foreign key
-- dwingt af dat het werkpakket werkelijk een school is.
create table public.school (
  werkpakket_id uuid primary key,
  soort public.werkpakket_soort not null default 'school' check (soort = 'school'),
  schooltype public.schooltype not null,
  adres text check (length(adres) <= 200),
  postcode text check (postcode ~ '^[1-9][0-9]{3} ?[A-Z]{2}$'),
  plaats text check (length(plaats) <= 100),
  foreign key (werkpakket_id, soort) references public.werkpakket (id, soort)
    on delete cascade on update restrict
);

-- Staffeluren worden afgeleid uit aantal_leerlingen. Een handmatige afwijking mag,
-- maar vraagt een toelichting.
create table public.school_schooljaar (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.school (werkpakket_id) on delete cascade,
  schooljaar_id uuid not null references public.schooljaar (id) on delete restrict,
  aantal_leerlingen integer not null check (aantal_leerlingen >= 0),
  uren_handmatig numeric check (uren_handmatig >= 0),
  toelichting text check (length(toelichting) <= 1000),
  unique (school_id, schooljaar_id),
  check (uren_handmatig is null or length(btrim(coalesce(toelichting, ''))) > 0)
);

-- Eén werkpakket kan meerdere MATT-projecten hebben. Leeg werkpakket = niet gekoppeld.
create table public.matt_project (
  id uuid primary key default gen_random_uuid(),
  projectnummer text not null unique check (projectnummer ~ '^\S{1,50}$'),
  naam_laatst_gezien text check (length(naam_laatst_gezien) <= 500),
  werkpakket_id uuid references public.werkpakket (id) on delete set null,
  genegeerd boolean not null default false
);

create index matt_project_werkpakket_idx on public.matt_project (werkpakket_id);

-- Toewijzing van een medewerker aan een werkpakket in een schooljaar.
-- Bij bron 'staffel' en 'norm_x_aantal' worden de uren afgeleid (fase 3) en blijven
-- de gepland_*-kolommen leeg; bij 'handmatig' zijn ze verplicht.
create table public.toewijzing (
  id uuid primary key default gen_random_uuid(),
  medewerker_id uuid not null references public.medewerker (id) on delete restrict,
  werkpakket_id uuid not null references public.werkpakket (id) on delete restrict,
  schooljaar_id uuid not null references public.schooljaar (id) on delete restrict,
  bron public.uren_bron not null,
  gepland_uitvoering numeric check (gepland_uitvoering >= 0),
  gepland_voorbereiding numeric check (gepland_voorbereiding >= 0),
  gepland_afronding numeric check (gepland_afronding >= 0),
  aantal_keer integer check (aantal_keer > 0),
  -- Deel van de staffeluren voor deze medewerker als meerdere LMC'ers op één school werken.
  aandeel_percentage numeric not null default 100
    check (aandeel_percentage > 0 and aandeel_percentage <= 100),
  verdeling public.verdeling not null,
  looptijd_van date,
  looptijd_tot date,
  toelichting text check (length(toelichting) <= 1000),
  unique (medewerker_id, werkpakket_id, schooljaar_id),
  check (
    (bron = 'handmatig') = (
      gepland_uitvoering is not null
      and gepland_voorbereiding is not null
      and gepland_afronding is not null
    )
  ),
  check (
    bron = 'handmatig'
    or (gepland_uitvoering is null and gepland_voorbereiding is null and gepland_afronding is null)
  ),
  check ((bron = 'norm_x_aantal') = (aantal_keer is not null)),
  check (bron = 'staffel' or aandeel_percentage = 100),
  check (
    (verdeling = 'looptijd') = (looptijd_van is not null and looptijd_tot is not null)
  ),
  check (verdeling = 'looptijd' or (looptijd_van is null and looptijd_tot is null)),
  check (looptijd_tot >= looptijd_van)
);

create index toewijzing_werkpakket_idx on public.toewijzing (werkpakket_id);
create index toewijzing_schooljaar_idx on public.toewijzing (schooljaar_id);

-- Datums bij verdeling 'op_datum'.
create table public.toewijzing_datum (
  id uuid primary key default gen_random_uuid(),
  toewijzing_id uuid not null references public.toewijzing (id) on delete cascade,
  datum date not null,
  unique (toewijzing_id, datum)
);

-- Controles die over tabellen heen gaan.
create function private.controleer_toewijzing()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_soort public.werkpakket_soort;
  v_start date;
  v_eind date;
begin
  select w.soort into v_soort from public.werkpakket w where w.id = new.werkpakket_id;
  select s.startdatum, s.einddatum into v_start, v_eind
  from public.schooljaar s where s.id = new.schooljaar_id;

  if new.bron = 'staffel' and v_soort <> 'school' then
    raise exception 'Bron staffel kan alleen bij een school.' using errcode = '23514';
  end if;
  if new.bron = 'norm_x_aantal' and v_soort <> 'activiteit' then
    raise exception 'Bron norm_x_aantal kan alleen bij een activiteit.' using errcode = '23514';
  end if;
  if new.verdeling = 'looptijd'
    and (new.looptijd_van < v_start or new.looptijd_tot > v_eind) then
    raise exception 'De looptijd valt niet binnen het schooljaar.' using errcode = '23514';
  end if;
  return new;
end
$$;

create function private.controleer_toewijzing_datum()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.toewijzing t
    join public.schooljaar s on s.id = t.schooljaar_id
    where t.id = new.toewijzing_id
      and t.verdeling = 'op_datum'
      and new.datum between s.startdatum and s.einddatum
  ) then
    raise exception 'Datum hoort niet bij een toewijzing met verdeling op_datum in dit schooljaar.'
      using errcode = '23514';
  end if;
  return new;
end
$$;

revoke execute on function
  private.controleer_toewijzing(),
  private.controleer_toewijzing_datum()
from public, anon, authenticated;

create trigger controleer
  before insert or update on public.toewijzing
  for each row execute function private.controleer_toewijzing();

create trigger controleer
  before insert or update on public.toewijzing_datum
  for each row execute function private.controleer_toewijzing_datum();

-- Rechten (SPEC §6)
-- Scholen, activiteiten, projecten en toewijzingen: beheer door coordinator en manager.
do $$
declare
  v_tabel text;
begin
  foreach v_tabel in array array[
    'public.activiteittype', 'public.werkpakket', 'public.school', 'public.school_schooljaar'
  ] loop
    perform private.beveilig_tabel(
      v_tabel::regclass,
      '(select private.heeft_toegang())',
      private.expr_rollen('{coordinator,manager}'),
      true,
      case when v_tabel = 'public.school' then 'werkpakket_id' else 'id' end
    );
  end loop;
end
$$;

-- MATT-projecten koppelen en negeren hoort bij het importproces.
select private.beveilig_tabel(
  'public.matt_project',
  '(select private.heeft_toegang())',
  private.expr_rollen('{coordinator,manager,beheerder}')
);

select private.beveilig_tabel(
  'public.toewijzing',
  'medewerker_id = (select private.eigen_medewerker_id()) or '
    || private.expr_rollen('{coordinator,manager,beheerder}'),
  private.expr_rollen('{coordinator,manager}')
);

-- Zichtbaar als de bijbehorende toewijzing zichtbaar is (RLS op toewijzing geldt in de subquery).
select private.beveilig_tabel(
  'public.toewijzing_datum',
  'exists (select 1 from public.toewijzing t where t.id = toewijzing_id)',
  private.expr_rollen('{coordinator,manager}')
);
