-- Expliciete rechten voor service_role.
-- Supabase kent nieuwe tabellen niet meer automatisch toe aan service_role. Edge Functions
-- (bijv. account-resetten: wachtwoordvlag zetten) en de MATT-import (fase 5) hebben die
-- rechten nodig. service_role bestaat alleen in Edge Functions (SPEC §1) en omzeilt RLS.
-- Het auditlog blijft ook voor service_role alleen-lezen.

do $$
declare
  v_tabel regclass;
begin
  for v_tabel in
    select c.oid::regclass
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p') and c.relname <> 'auditlog'
  loop
    execute format('grant select, insert, update, delete on table %s to service_role', v_tabel);
  end loop;
end
$$;

grant select on table public.auditlog to service_role;

-- Nieuwe tabellen krijgen via beveilig_tabel() dezelfde rechten.
create or replace function private.beveilig_tabel(
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
  execute format('grant select, insert, update, delete on table %s to service_role', p_tabel);
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
