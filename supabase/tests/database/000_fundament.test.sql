-- Fundamenttest (fase 0): controleert dat pgTAP werkt en dat er nog geen
-- tabellen zonder RLS in het schema public staan.
begin;
create extension if not exists pgtap with schema extensions;

select plan(2);

select has_extension('pgtap', 'pgTAP is beschikbaar');

select is_empty(
  $$
    select c.relname
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and not c.relrowsecurity
  $$,
  'Elke tabel in public heeft RLS aan'
);

select * from finish();
rollback;
