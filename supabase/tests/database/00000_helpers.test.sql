-- Testhulpfuncties in schema tests. Dit bestand draait als eerste (alfabetisch) en
-- wordt bewust NIET teruggedraaid, zodat de volgende testbestanden de functies kunnen
-- gebruiken. Het schema tests bestaat alleen in test- en lokale databases.

create extension if not exists pgtap with schema extensions;

create schema if not exists tests;
grant usage on schema tests to anon, authenticated, service_role;

-- Persona's voor de rechtenmatrix. Wordt per testbestand gevuld (binnen de transactie).
create table if not exists tests.persona (
  naam text primary key,
  gebruiker_id uuid,
  medewerker_id uuid,
  db_rol text not null,
  aal text
);
grant select on tests.persona to anon, authenticated, service_role;

-- Alle persona's, in vaste volgorde.
create or replace function tests.personas()
returns text[]
language sql
immutable
as $$
  select array[
    'lmc_a', 'lmc_b', 'coordinator', 'manager', 'beheerder',
    'lmc_a_aal1', 'manager_aal1', 'zonder_rol', 'zonder_medewerker', 'inactief',
    'moet_wijzigen', 'anon'
  ]
$$;

-- Maakt een auth-gebruiker met (optioneel) medewerker, profiel en rollen.
create or replace function tests.maak_gebruiker(
  p_naam text,
  p_rollen public.rol[],
  p_met_medewerker boolean default true,
  p_actief boolean default true,
  p_moet_wijzigen boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_gebruiker uuid := gen_random_uuid();
  v_medewerker uuid;
begin
  insert into auth.users (id, email, aud, role)
  values (v_gebruiker, replace(p_naam, '_', '-') || '@voorbeeld.test', 'authenticated', 'authenticated');

  if p_met_medewerker then
    insert into public.medewerker (voornaam, achternaam, email, actief)
    values ('Test', p_naam, replace(p_naam, '_', '-') || '@voorbeeld.test', p_actief)
    returning id into v_medewerker;
    insert into public.profiel (gebruiker_id, medewerker_id, moet_wachtwoord_wijzigen)
    values (v_gebruiker, v_medewerker, p_moet_wijzigen);
  end if;

  insert into public.gebruiker_rol (gebruiker_id, rol)
  select v_gebruiker, r from unnest(p_rollen) as r;

  insert into tests.persona (naam, gebruiker_id, medewerker_id, db_rol, aal)
  values (p_naam, v_gebruiker, v_medewerker, 'authenticated', 'aal2');
  return v_gebruiker;
end
$$;

-- Vult tests.persona met alle persona's uit tests.personas().
create or replace function tests.maak_personas()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform tests.maak_gebruiker('lmc_a', '{lmc}');
  perform tests.maak_gebruiker('lmc_b', '{lmc}');
  perform tests.maak_gebruiker('coordinator', '{coordinator}');
  perform tests.maak_gebruiker('manager', '{manager}');
  perform tests.maak_gebruiker('beheerder', '{beheerder}');
  -- Zelfde gebruikers, maar zonder tweestapsverificatie.
  insert into tests.persona (naam, gebruiker_id, medewerker_id, db_rol, aal)
  select n.naam || '_aal1', p.gebruiker_id, p.medewerker_id, 'authenticated', 'aal1'
  from tests.persona p
  join (values ('lmc_a'), ('manager')) as n (naam) on n.naam = p.naam;
  perform tests.maak_gebruiker('zonder_rol', '{}');
  perform tests.maak_gebruiker('zonder_medewerker', '{lmc}', false);
  perform tests.maak_gebruiker('inactief', '{coordinator}', true, false);
  perform tests.maak_gebruiker('moet_wijzigen', '{manager}', true, true, true);
  insert into tests.persona (naam, db_rol) values ('anon', 'anon'), ('service_role', 'service_role'),
    -- Tabeleigenaar (zoals de migraties); voor tests van constraints.
    ('eigenaar', 'postgres');
end
$$;

create or replace function tests.mw(p_persona text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select medewerker_id from tests.persona where naam = p_persona
$$;

create or replace function tests.gb(p_persona text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select gebruiker_id from tests.persona where naam = p_persona
$$;

-- Zet de database-rol en JWT-claims van een persona (alleen binnen de transactie).
create or replace function tests.wissel(p_persona text)
returns void
language plpgsql
as $$
declare
  v tests.persona;
begin
  select * into v from tests.persona where naam = p_persona;
  if not found then
    raise exception 'Onbekende persona %', p_persona;
  end if;
  perform set_config(
    'request.jwt.claims',
    case
      when v.gebruiker_id is null then json_build_object('role', v.db_rol)::text
      else json_build_object('sub', v.gebruiker_id, 'role', v.db_rol, 'aal', v.aal)::text
    end,
    true
  );
  perform set_config('role', v.db_rol, true);
end
$$;

-- Voert een statement uit als persona en draait het daarna altijd terug.
-- Resultaat: 'rijen:N', 'geweigerd' (42501) of 'fout:<sqlstate> <melding>'.
create or replace function tests.probeer(p_persona text, p_sql text)
returns text
language plpgsql
as $$
declare
  v_n bigint;
begin
  begin
    perform tests.wissel(p_persona);
    execute p_sql;
    get diagnostics v_n = row_count;
    raise exception using errcode = 'TT001', message = v_n::text;
  exception
    when sqlstate 'TT001' then
      return 'rijen:' || sqlerrm;
    when insufficient_privilege then
      return 'geweigerd';
    when others then
      return 'fout:' || sqlstate || ' ' || sqlerrm;
  end;
end
$$;

-- Telt de rijen die een persona met een query te zien krijgt.
create or replace function tests.aantal(p_persona text, p_query text)
returns text
language plpgsql
as $$
declare
  v_n bigint;
begin
  begin
    perform tests.wissel(p_persona);
    execute 'select count(*) from (' || p_query || ') as q' into v_n;
    raise exception using errcode = 'TT001', message = v_n::text;
  exception
    when sqlstate 'TT001' then
      return 'rijen:' || sqlerrm;
    when insufficient_privilege then
      return 'geweigerd';
    when others then
      return 'fout:' || sqlstate || ' ' || sqlerrm;
  end;
end
$$;

-- Eerste waarde (als tekst) van een query, uitgevoerd als persona en daarna teruggedraaid.
create or replace function tests.waarde(p_persona text, p_query text)
returns text
language plpgsql
as $$
declare
  v text;
begin
  begin
    perform tests.wissel(p_persona);
    execute 'select (' || p_query || ')::text' into v;
    raise exception using errcode = 'TT001', message = coalesce(v, '<null>');
  exception
    when sqlstate 'TT001' then
      return sqlerrm;
    when insufficient_privilege then
      return 'geweigerd';
    when others then
      return 'fout:' || sqlstate || ' ' || sqlerrm;
  end;
end
$$;

-- Rechtenmatrix voor één tabel, voor alle persona's (SPEC §6).
--   p_lees:       {"persona": "alles" | "eigen"}; ontbrekende persona's zien niets.
--   p_eigen:      where-voorwaarde voor "eigen", met plaatshouders $mw (medewerker-ID)
--                 en $gb (gebruiker-ID) van de persona.
--   p_schrijvers: persona's die mogen toevoegen, wijzigen en verwijderen.
--   p_insert/p_update/p_delete: statements; null = overslaan.
-- Toegestaan schrijven moet minstens één rij raken; geweigerd schrijven geeft
-- 42501 of raakt nul rijen.
create or replace function tests.matrix(
  p_tabel text,
  p_lees jsonb,
  p_eigen text,
  p_schrijvers text[],
  p_insert text,
  p_update text,
  p_delete text
)
returns setof text
language plpgsql
as $$
declare
  v_persona text;
  v_lees text;
  v_aantal bigint;
  v_verwacht text;
  v_mag boolean;
  v_label text;
  v_ja constant text := '^rijen:[1-9][0-9]*$';
  v_nee constant text := '^(geweigerd|rijen:0)$';
begin
  foreach v_persona in array tests.personas() loop
    v_lees := coalesce(p_lees ->> v_persona, 'niets');
    if v_lees = 'alles' then
      execute format('select count(*) from %s', p_tabel) into v_aantal;
      v_verwacht := '^rijen:' || v_aantal || '$';
    elsif v_lees = 'eigen' then
      execute format(
        'select count(*) from %s where %s',
        p_tabel,
        replace(
          replace(p_eigen, '$mw', quote_nullable(tests.mw(v_persona))),
          '$gb', quote_nullable(tests.gb(v_persona))
        )
      ) into v_aantal;
      v_verwacht := '^rijen:' || v_aantal || '$';
    else
      v_verwacht := v_nee;
    end if;
    return next matches(
      tests.aantal(v_persona, 'select * from ' || p_tabel),
      v_verwacht,
      format('%s: %s lezen (%s)', v_persona, p_tabel, v_lees)
    );

    v_mag := v_persona = any (p_schrijvers);
    v_label := case when v_mag then 'toegestaan' else 'geweigerd' end;
    if p_insert is not null then
      return next matches(
        tests.probeer(v_persona, p_insert), case when v_mag then v_ja else v_nee end,
        format('%s: %s toevoegen %s', v_persona, p_tabel, v_label)
      );
    end if;
    if p_update is not null then
      return next matches(
        tests.probeer(v_persona, p_update), case when v_mag then v_ja else v_nee end,
        format('%s: %s wijzigen %s', v_persona, p_tabel, v_label)
      );
    end if;
    if p_delete is not null then
      return next matches(
        tests.probeer(v_persona, p_delete), case when v_mag then v_ja else v_nee end,
        format('%s: %s verwijderen %s', v_persona, p_tabel, v_label)
      );
    end if;
  end loop;
end
$$;

-- Leesprofielen die vaak terugkomen.
create or replace function tests.lees_alle()
returns jsonb
language sql
immutable
as $$
  select '{"lmc_a":"alles","lmc_b":"alles","coordinator":"alles","manager":"alles","beheerder":"alles"}'::jsonb
$$;

create or replace function tests.lees_eigen_of_cmb()
returns jsonb
language sql
immutable
as $$
  select '{"lmc_a":"eigen","lmc_b":"eigen","coordinator":"alles","manager":"alles","beheerder":"alles"}'::jsonb
$$;

create or replace function tests.lees_cmb()
returns jsonb
language sql
immutable
as $$
  select '{"coordinator":"alles","manager":"alles","beheerder":"alles"}'::jsonb
$$;

grant execute on all functions in schema tests to anon, authenticated, service_role;

select plan(1);
select pass('Testhulpfuncties geladen');
select * from finish();
