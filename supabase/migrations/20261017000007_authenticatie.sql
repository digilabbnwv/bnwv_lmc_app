-- Authenticatie (SPEC §7): eigen status vóór toegang, rechtencontrole voor de
-- Edge Functions, account resetten, wachtwoordvlag en sessies beëindigen.

-- ---------------------------------------------------------------------------
-- Eigen status, ook op aal1
-- ---------------------------------------------------------------------------

-- Geeft alleen vlaggen over de eigen gebruiker terug, nooit gegevens. De frontend
-- gebruikt dit om te bepalen welke stap van de inlogstroom nodig is.
create function public.mijn_status()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'moet_wachtwoord_wijzigen', coalesce(
      (select p.moet_wachtwoord_wijzigen from public.profiel p where p.gebruiker_id = auth.uid()),
      false
    ),
    'heeft_toegang_na_mfa', exists (
      select 1
      from public.profiel p
      join public.medewerker m on m.id = p.medewerker_id
      where p.gebruiker_id = auth.uid()
        and m.actief
        and exists (select 1 from public.gebruiker_rol r where r.gebruiker_id = p.gebruiker_id)
    )
  )
  where auth.uid() is not null
$$;

revoke execute on function public.mijn_status() from public, anon;
grant execute on function public.mijn_status() to authenticated;

-- ---------------------------------------------------------------------------
-- Rechtencontrole voor de Edge Functions
-- ---------------------------------------------------------------------------

-- Waar als de aanroeper accounts mag beheren: manager of beheerder, op aal2.
-- De Edge Functions roepen dit aan met de JWT van de aanroeper, zodat de
-- database beslist (SPEC §1).
create function public.mag_gebruikers_beheren()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.heeft_een_rol('{manager,beheerder}')
$$;

revoke execute on function public.mag_gebruikers_beheren() from public, anon;
grant execute on function public.mag_gebruikers_beheren() to authenticated;

-- Beëindigt alle sessies van een gebruiker (refresh tokens vervallen mee).
-- Een nog geldig access token geeft daarna ook geen toegang meer, omdat
-- heeft_toegang() de wachtwoordvlag, de rol en de medewerker controleert.
create function private.beeindig_sessies(p_gebruiker_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from auth.refresh_tokens where user_id = p_gebruiker_id::text;
  delete from auth.sessions where user_id = p_gebruiker_id;
$$;

revoke execute on function private.beeindig_sessies(uuid) from public, anon, authenticated;

-- Eerste stap van een accountreset (Edge Function account-resetten):
-- controleert de rechten, zet de wachtwoordvlag, beëindigt alle sessies en
-- schrijft de reset in het auditlog. Een gebruiker kan zijn eigen account niet resetten.
create function public.account_reset_voorbereiden(p_gebruiker_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.heeft_een_rol('{manager,beheerder}') then
    raise exception 'Geen recht om accounts te resetten.' using errcode = '42501';
  end if;
  if p_gebruiker_id is null or p_gebruiker_id = auth.uid() then
    raise exception 'Je kunt je eigen account niet resetten.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiel p where p.gebruiker_id = p_gebruiker_id) then
    raise exception 'Onbekend account.' using errcode = 'P0002';
  end if;
  -- Een beheerder resetten mag alleen een andere beheerder (zelfde regel als bij rollen).
  if exists (
    select 1 from public.gebruiker_rol r
    where r.gebruiker_id = p_gebruiker_id and r.rol = 'beheerder'
  ) and not private.heeft_rol('beheerder') then
    raise exception 'Alleen een beheerder kan een beheerder resetten.' using errcode = '42501';
  end if;

  update public.profiel set moet_wachtwoord_wijzigen = true
  where gebruiker_id = p_gebruiker_id;

  perform private.beeindig_sessies(p_gebruiker_id);

  perform private.log_actie(
    'account_reset', 'auth.users', p_gebruiker_id::text, null,
    jsonb_build_object('gebruiker_id', p_gebruiker_id)
  );
end
$$;

revoke execute on function public.account_reset_voorbereiden(uuid) from public, anon;
grant execute on function public.account_reset_voorbereiden(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Wachtwoordvlag
-- ---------------------------------------------------------------------------

-- Zodra het wachtwoord werkelijk verandert, vervalt de verplichting om het te
-- wijzigen. Na een tijdelijk wachtwoord van een beheerder zet de Edge Function
-- de vlag direct weer op true.
create function private.wachtwoord_gewijzigd()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiel set moet_wachtwoord_wijzigen = false
  where gebruiker_id = new.id and moet_wachtwoord_wijzigen;
  return null;
end
$$;

revoke execute on function private.wachtwoord_gewijzigd() from public, anon, authenticated;

create trigger bnwv_wachtwoord_gewijzigd
  after update of encrypted_password on auth.users
  for each row
  when (old.encrypted_password is distinct from new.encrypted_password)
  execute function private.wachtwoord_gewijzigd();

-- ---------------------------------------------------------------------------
-- Deactiveren trekt de toegang direct in (SPEC §7)
-- ---------------------------------------------------------------------------

create function private.medewerker_gedeactiveerd()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_gebruiker uuid;
begin
  select p.gebruiker_id into v_gebruiker from public.profiel p where p.medewerker_id = new.id;
  if v_gebruiker is not null then
    perform private.beeindig_sessies(v_gebruiker);
  end if;
  return null;
end
$$;

revoke execute on function private.medewerker_gedeactiveerd() from public, anon, authenticated;

create trigger sessies_beeindigen
  after update of actief on public.medewerker
  for each row
  when (old.actief and not new.actief)
  execute function private.medewerker_gedeactiveerd();
