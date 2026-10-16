-- Fundamenttests: algemene beveiligingsregels die voor élke migratie gelden (SPEC §1).
begin;
create extension if not exists pgtap with schema extensions;

select plan(10);

select has_extension('pgtap', 'pgTAP is beschikbaar');

-- Edge Functions gebruiken service_role; Supabase kent die rechten niet meer automatisch toe.
select is_empty(
  $$
    select c.relname
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and c.relname <> 'auditlog'
      and not (
        has_table_privilege('service_role', c.oid, 'select')
        and has_table_privilege('service_role', c.oid, 'insert')
        and has_table_privilege('service_role', c.oid, 'update')
        and has_table_privilege('service_role', c.oid, 'delete')
      )
  $$,
  'service_role heeft volledige rechten op elke tabel in public (behalve het auditlog)'
);

select ok(
  has_table_privilege('service_role', 'public.auditlog', 'select')
    and not has_table_privilege('service_role', 'public.auditlog', 'insert')
    and not has_table_privilege('service_role', 'public.auditlog', 'update')
    and not has_table_privilege('service_role', 'public.auditlog', 'delete'),
  'service_role mag het auditlog alleen lezen'
);

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

select is_empty(
  $$
    select c.relname
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and not exists (select 1 from pg_catalog.pg_policy p where p.polrelid = c.oid)
  $$,
  'Elke tabel in public heeft minstens één policy'
);

select is_empty(
  $$
    select c.relname
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p', 'v', 'm')
      and (
        has_table_privilege('anon', c.oid, 'select')
        or has_table_privilege('anon', c.oid, 'insert')
        or has_table_privilege('anon', c.oid, 'update')
        or has_table_privilege('anon', c.oid, 'delete')
      )
  $$,
  'anon heeft geen rechten op tabellen of views in public'
);

select is_empty(
  $$
    select p.oid::regprocedure::text
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private')
      and has_function_privilege('anon', p.oid, 'execute')
  $$,
  'anon kan geen functies in public of private uitvoeren'
);

select is_empty(
  $$
    select p.oid::regprocedure::text
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private')
      and p.prosecdef
      and not coalesce('search_path=""' = any (p.proconfig), false)
  $$,
  'Elke SECURITY DEFINER-functie heeft search_path = '''''
);

select is_empty(
  $$
    select c.relname
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'v'
      and not coalesce('security_invoker=true' = any (c.reloptions), false)
  $$,
  'Elke view in public heeft security_invoker = true'
);

select is_empty(
  $$
    select c.table_name || '.' || c.column_name
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.column_name ~ '(reden|ziekte|verlof)'
  $$,
  'Geen kolommen voor de reden van afwezigheid (dataminimalisatie)'
);

select * from finish();
rollback;
