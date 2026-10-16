-- Basis: extensies, het niet-publieke schema private, enum-types en standaardrechten.
-- Zie docs/SPEC.md §1 (beveiliging) en docs/DECISIONS.md (fase 1).

create extension if not exists btree_gist with schema extensions;

-- Schema voor hulpfuncties. Wordt niet via de Data API ontsloten.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

-- Standaardrechten: nieuwe objecten zijn voor anon en authenticated nergens toegankelijk,
-- tenzij een migratie expliciet rechten toekent.
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on functions from anon, authenticated;
alter default privileges for role postgres revoke execute on functions from public;

-- Enum-types
create type public.rol as enum ('lmc', 'coordinator', 'manager', 'beheerder');
create type public.schooltype as enum ('PO', 'VO', 'BoekStart');
create type public.vestiging as enum ('HAR', 'ERM', 'NUN', 'PUT', 'ELS', 'overig');
create type public.werkpakket_soort as enum ('school', 'activiteit', 'project');
create type public.uren_bron as enum ('staffel', 'norm_x_aantal', 'handmatig');
create type public.verdeling as enum ('schoolweken', 'looptijd', 'op_datum');
create type public.import_status as enum ('concept', 'definitief', 'teruggedraaid');
create type public.alias_bron as enum ('matt', 'planning');
create type public.boeking_categorie as enum ('uitvoering', 'voorbereiding_afronding', 'relatiebeheer');

-- Normaliseert een naam voor het matchen van aliassen (SPEC §4):
-- trim, meerdere spaties samenvoegen, kleine letters.
-- Moet gelijk blijven aan supabase/functions/_gedeeld/normaliseer.ts.
create function private.normaliseer_naam(p_naam text)
returns text
language sql
immutable
strict
parallel safe
set search_path = ''
as $$
  select pg_catalog.lower(
    pg_catalog.regexp_replace(
      pg_catalog.regexp_replace(p_naam, '^\s+|\s+$', '', 'g'),
      '\s+', ' ', 'g'
    )
  )
$$;

revoke execute on function private.normaliseer_naam(text) from public, anon;
grant execute on function private.normaliseer_naam(text) to authenticated;
