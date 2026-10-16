-- Beheer (fase 4): RPC's voor bewerkingen die in één transactie moeten.
-- Alle functies zijn SECURITY INVOKER: RLS op de onderliggende tabellen beslist.

-- Een school vastleggen: werkpakket (soort school) en schoolgegevens samen.
-- p_werkpakket_id leeg = nieuwe school. Geeft het werkpakket-ID terug.
create function public.school_opslaan(
  p_werkpakket_id uuid,
  p_naam text,
  p_vestiging public.vestiging,
  p_actief boolean,
  p_schooltype public.schooltype,
  p_adres text,
  p_postcode text,
  p_plaats text
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid := p_werkpakket_id;
begin
  if v_id is null then
    insert into public.werkpakket (soort, naam, vestiging, actief)
    values ('school', p_naam, p_vestiging, coalesce(p_actief, true))
    returning id into v_id;
    insert into public.school (werkpakket_id, schooltype, adres, postcode, plaats)
    values (v_id, p_schooltype, p_adres, p_postcode, p_plaats);
  else
    update public.werkpakket
    set naam = p_naam, vestiging = p_vestiging, actief = coalesce(p_actief, true)
    where id = v_id and soort = 'school';
    if not found then
      raise exception 'Onbekende school.' using errcode = 'P0002';
    end if;
    update public.school
    set schooltype = p_schooltype, adres = p_adres, postcode = p_postcode, plaats = p_plaats
    where werkpakket_id = v_id;
    if not found then
      raise exception 'Onbekende school.' using errcode = 'P0002';
    end if;
  end if;
  return v_id;
end
$$;

-- Vervangt alle datums van een toewijzing met verdeling op_datum in één keer.
create function public.toewijzing_datums_vervangen(p_toewijzing_id uuid, p_datums date[])
returns void
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from public.toewijzing t where t.id = p_toewijzing_id) then
    raise exception 'Onbekende toewijzing.' using errcode = 'P0002';
  end if;
  delete from public.toewijzing_datum where toewijzing_id = p_toewijzing_id;
  insert into public.toewijzing_datum (toewijzing_id, datum)
  select p_toewijzing_id, d from (select distinct unnest(coalesce(p_datums, '{}')) as d) as x;
end
$$;

-- Kopieert de configuratie van een schooljaar naar een ander (leeg) schooljaar:
-- staffel, opslagfactoren (opnieuw "nog te bevestigen") en schoolvakanties. De
-- vakantiedatums schuiven mee met het verschil in startdatum en moeten daarna
-- worden gecontroleerd. Toewijzingen worden NIET gekopieerd (SPEC §11).
create function public.schooljaar_configuratie_kopieren(p_van_id uuid, p_naar_id uuid)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_van public.schooljaar;
  v_naar public.schooljaar;
  v_verschuiving integer;
  v_staffel integer;
  v_opslag integer;
  v_vakantie integer;
begin
  select * into v_van from public.schooljaar where id = p_van_id;
  select * into v_naar from public.schooljaar where id = p_naar_id;
  if v_van.id is null or v_naar.id is null or v_van.id = v_naar.id then
    raise exception 'Kies twee verschillende, bestaande schooljaren.' using errcode = '22023';
  end if;
  if exists (select 1 from public.staffel where schooljaar_id = p_naar_id)
    or exists (select 1 from public.opslagfactor where schooljaar_id = p_naar_id)
    or exists (select 1 from public.schoolvakantie where schooljaar_id = p_naar_id) then
    raise exception 'Het schooljaar % heeft al configuratie.', v_naar.naam using errcode = '23505';
  end if;

  v_verschuiving := v_naar.startdatum - v_van.startdatum;

  insert into public.staffel (schooljaar_id, schooltype, leerlingen_min, leerlingen_max, uren)
  select p_naar_id, s.schooltype, s.leerlingen_min, s.leerlingen_max, s.uren
  from public.staffel s where s.schooljaar_id = p_van_id;
  get diagnostics v_staffel = row_count;

  insert into public.opslagfactor (schooljaar_id, schooltype, factor, bevestigd)
  select p_naar_id, o.schooltype, o.factor, false
  from public.opslagfactor o where o.schooljaar_id = p_van_id;
  get diagnostics v_opslag = row_count;

  insert into public.schoolvakantie (schooljaar_id, naam, van, tot)
  select p_naar_id, v.naam, v.nieuw_van, v.nieuw_tot
  from (
    select sv.naam,
      greatest(sv.van + v_verschuiving, v_naar.startdatum) as nieuw_van,
      least(sv.tot + v_verschuiving, v_naar.einddatum) as nieuw_tot
    from public.schoolvakantie sv
    where sv.schooljaar_id = p_van_id
  ) as v
  where v.nieuw_van <= v.nieuw_tot;
  get diagnostics v_vakantie = row_count;

  return jsonb_build_object('staffel', v_staffel, 'opslagfactor', v_opslag, 'schoolvakantie', v_vakantie);
end
$$;

revoke execute on function
  public.school_opslaan(uuid, text, public.vestiging, boolean, public.schooltype, text, text, text),
  public.toewijzing_datums_vervangen(uuid, date[]),
  public.schooljaar_configuratie_kopieren(uuid, uuid)
from public, anon;

grant execute on function
  public.school_opslaan(uuid, text, public.vestiging, boolean, public.schooltype, text, text, text),
  public.toewijzing_datums_vervangen(uuid, date[]),
  public.schooljaar_configuratie_kopieren(uuid, uuid)
to authenticated, service_role;

-- Het e-mailadres van een medewerker met account moet gelijk blijven aan het account
-- (SPEC §7: account-e-mail = medewerker-e-mail). Wijzigen kan dan niet via beheer.
create function private.medewerker_email_vast()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is distinct from old.email
    and exists (select 1 from public.profiel p where p.medewerker_id = new.id) then
    raise exception 'Het e-mailadres van een medewerker met account kan niet worden gewijzigd.'
      using errcode = '23514';
  end if;
  return new;
end
$$;

revoke execute on function private.medewerker_email_vast() from public, anon, authenticated;

create trigger email_vast
  before update of email on public.medewerker
  for each row execute function private.medewerker_email_vast();
