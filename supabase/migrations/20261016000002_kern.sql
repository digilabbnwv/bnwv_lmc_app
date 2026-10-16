-- Kern: medewerker, rollen, profiel, auditlog en de RLS-hulpfuncties.
-- Autorisatie zit in de database (SPEC §1, §6). Rollen staan in een eigen tabel,
-- nooit in user_metadata.

-- ---------------------------------------------------------------------------
-- Tabellen
-- ---------------------------------------------------------------------------

create table public.medewerker (
  id uuid primary key default gen_random_uuid(),
  voornaam text not null check (length(btrim(voornaam)) between 1 and 100),
  achternaam text not null check (length(btrim(achternaam)) between 1 and 100),
  email text not null unique
    check (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  actief boolean not null default true
);

comment on table public.medewerker is
  'Medewerker. Elke gebruiker, ook manager en beheerder, is gekoppeld aan een medewerker.';

create table public.gebruiker_rol (
  id uuid primary key default gen_random_uuid(),
  gebruiker_id uuid not null references auth.users (id) on delete cascade,
  rol public.rol not null,
  unique (gebruiker_id, rol)
);

create table public.profiel (
  gebruiker_id uuid primary key references auth.users (id) on delete cascade,
  medewerker_id uuid not null unique references public.medewerker (id) on delete restrict,
  moet_wachtwoord_wijzigen boolean not null default true
);

comment on column public.profiel.moet_wachtwoord_wijzigen is
  'Wordt alleen door Edge Functions (service_role) en triggers gewijzigd, nooit door de gebruiker zelf.';

-- Append-only: er bestaan geen policies voor update of delete, ook niet voor beheerders.
create table public.auditlog (
  id bigint generated always as identity primary key,
  tijdstip timestamptz not null default now(),
  gebruiker_id uuid,
  actie text not null,
  tabel text,
  record_id text,
  oude_waarde jsonb,
  nieuwe_waarde jsonb
);

create index auditlog_tijdstip_idx on public.auditlog (tijdstip);

-- ---------------------------------------------------------------------------
-- RLS-hulpfuncties
-- ---------------------------------------------------------------------------

-- Tweestapsverificatie is voor elke rol verplicht.
create function private.is_aal2()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
$$;

-- Toegang alleen met aal2, een actieve gekoppelde medewerker, minstens één rol
-- en een gewijzigd tijdelijk wachtwoord.
create function private.heeft_toegang()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_aal2()
    and exists (
      select 1
      from public.profiel p
      join public.medewerker m on m.id = p.medewerker_id
      where p.gebruiker_id = auth.uid()
        and m.actief
        and not p.moet_wachtwoord_wijzigen
        and exists (select 1 from public.gebruiker_rol r where r.gebruiker_id = p.gebruiker_id)
    )
$$;

create function private.heeft_rol(p_rol public.rol)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.heeft_toegang()
    and exists (
      select 1 from public.gebruiker_rol r
      where r.gebruiker_id = auth.uid() and r.rol = p_rol
    )
$$;

create function private.heeft_een_rol(p_rollen public.rol[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.heeft_toegang()
    and exists (
      select 1 from public.gebruiker_rol r
      where r.gebruiker_id = auth.uid() and r.rol = any (p_rollen)
    )
$$;

-- Medewerker-ID van de ingelogde gebruiker, of null als er geen toegang is.
create function private.eigen_medewerker_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.medewerker_id
  from public.profiel p
  where p.gebruiker_id = auth.uid()
    and private.heeft_toegang()
$$;

revoke execute on function
  private.is_aal2(),
  private.heeft_toegang(),
  private.heeft_rol(public.rol),
  private.heeft_een_rol(public.rol[]),
  private.eigen_medewerker_id()
from public, anon;

grant execute on function
  private.is_aal2(),
  private.heeft_toegang(),
  private.heeft_rol(public.rol),
  private.heeft_een_rol(public.rol[]),
  private.eigen_medewerker_id()
to authenticated;

-- ---------------------------------------------------------------------------
-- Auditlog
-- ---------------------------------------------------------------------------

-- Schrijft één regel naar het auditlog. Alleen aan te roepen vanuit andere
-- SECURITY DEFINER-functies; niet uitvoerbaar voor gebruikers.
create function private.log_actie(
  p_actie text,
  p_tabel text,
  p_record_id text,
  p_oude_waarde jsonb,
  p_nieuwe_waarde jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.auditlog (gebruiker_id, actie, tabel, record_id, oude_waarde, nieuwe_waarde)
  values (auth.uid(), p_actie, p_tabel, p_record_id, p_oude_waarde, p_nieuwe_waarde)
$$;

-- Generieke audit-trigger. Argument 0: naam van de sleutelkolom (standaard 'id').
create function private.audit_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_oud jsonb;
  v_nieuw jsonb;
  v_kolom text := coalesce(tg_argv[0], 'id');
begin
  if tg_op in ('UPDATE', 'DELETE') then
    v_oud := to_jsonb(old);
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    v_nieuw := to_jsonb(new);
  end if;
  perform private.log_actie(
    lower(tg_op), tg_table_name, coalesce(v_nieuw, v_oud) ->> v_kolom, v_oud, v_nieuw
  );
  return null;
end
$$;

-- Weigert elke wijziging of verwijdering van het auditlog, ook voor service_role.
create function private.auditlog_onwijzigbaar()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Het auditlog is append-only.' using errcode = '42501';
end
$$;

revoke execute on function
  private.log_actie(text, text, text, jsonb, jsonb),
  private.audit_trigger(),
  private.auditlog_onwijzigbaar()
from public, anon, authenticated;

create trigger auditlog_geen_wijziging
  before update or delete on public.auditlog
  for each row execute function private.auditlog_onwijzigbaar();

create trigger auditlog_geen_truncate
  before truncate on public.auditlog
  for each statement execute function private.auditlog_onwijzigbaar();

-- ---------------------------------------------------------------------------
-- Beveiligen van een tabel
-- ---------------------------------------------------------------------------

-- Richt een tabel volgens één vast patroon in ("niets mag, tenzij"):
-- RLS aan, geen rechten voor anon, select voor authenticated met policy p_lezen,
-- en (als p_schrijven niet null is) insert/update/delete met policy p_schrijven.
-- Met p_audit komt er een audit-trigger op de tabel.
create function private.beveilig_tabel(
  p_tabel regclass,
  p_lezen text,
  p_schrijven text,
  p_audit boolean default true,
  p_sleutelkolom text default 'id'
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  execute format('alter table %s enable row level security', p_tabel);
  execute format('revoke all on table %s from public, anon, authenticated', p_tabel);
  execute format('grant select on table %s to authenticated', p_tabel);
  execute format(
    'create policy lezen on %s for select to authenticated using (%s)', p_tabel, p_lezen
  );

  if p_schrijven is not null then
    execute format('grant insert, update, delete on table %s to authenticated', p_tabel);
    execute format(
      'create policy toevoegen on %s for insert to authenticated with check (%s)',
      p_tabel, p_schrijven
    );
    execute format(
      'create policy wijzigen on %1$s for update to authenticated using (%2$s) with check (%2$s)',
      p_tabel, p_schrijven
    );
    execute format(
      'create policy verwijderen on %s for delete to authenticated using (%s)',
      p_tabel, p_schrijven
    );
  end if;

  if p_audit then
    execute format(
      'create trigger audit after insert or update or delete on %s '
      'for each row execute function private.audit_trigger(%L)',
      p_tabel, p_sleutelkolom
    );
  end if;
end
$$;

revoke execute on function private.beveilig_tabel(regclass, text, text, boolean, text)
from public, anon, authenticated;

-- Policy-expressie: de gebruiker heeft (toegang en) een van de gegeven rollen.
create function private.expr_rollen(p_rollen public.rol[])
returns text
language sql
immutable
set search_path = ''
as $$
  select format('(select private.heeft_een_rol(%L::public.rol[]))', p_rollen)
$$;

revoke execute on function private.expr_rollen(public.rol[]) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Rechten op de kerntabellen (SPEC §6)
-- ---------------------------------------------------------------------------

-- medewerker: eigen rij, of alles voor coordinator/manager/beheerder.
select private.beveilig_tabel(
  'public.medewerker',
  'id = (select private.eigen_medewerker_id()) or '
    || private.expr_rollen('{coordinator,manager,beheerder}'),
  private.expr_rollen('{coordinator,manager,beheerder}')
);

-- gebruiker_rol: eigen rollen, of alles voor manager/beheerder. Niemand wijzigt
-- zijn eigen rollen, en alleen een beheerder kent de rol beheerder toe of neemt hem af.
select private.beveilig_tabel(
  'public.gebruiker_rol',
  '(gebruiker_id = (select auth.uid()) and (select private.heeft_toegang())) or '
    || private.expr_rollen('{manager,beheerder}'),
  private.expr_rollen('{manager,beheerder}')
    || ' and gebruiker_id <> (select auth.uid())'
    || ' and (rol <> ''beheerder'' or (select private.heeft_rol(''beheerder'')))'
);

-- profiel: eigen profiel, of alles voor manager/beheerder. Niemand wijzigt zijn
-- eigen profiel. moet_wachtwoord_wijzigen is niet door gebruikers te wijzigen.
select private.beveilig_tabel(
  'public.profiel',
  '(gebruiker_id = (select auth.uid()) and (select private.heeft_toegang())) or '
    || private.expr_rollen('{manager,beheerder}'),
  private.expr_rollen('{manager,beheerder}') || ' and gebruiker_id <> (select auth.uid())',
  true,
  'gebruiker_id'
);
revoke insert, update on table public.profiel from authenticated;
grant insert (gebruiker_id, medewerker_id), update (medewerker_id) on table public.profiel
  to authenticated;

-- auditlog: alleen lezen voor manager/beheerder. Schrijven gebeurt uitsluitend
-- via private.log_actie (SECURITY DEFINER).
select private.beveilig_tabel(
  'public.auditlog',
  private.expr_rollen('{manager,beheerder}'),
  null,
  false
);
revoke insert, update, delete, truncate on table public.auditlog from service_role;
