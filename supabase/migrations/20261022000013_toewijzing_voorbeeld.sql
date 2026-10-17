-- Rekenvoorbeeld voor het toewijzingsformulier (UI-4): hoeveel uur levert een toewijzing
-- op, en over hoeveel dagen wordt dat verdeeld, vóórdat je opslaat?
--
-- Er komen geen nieuwe rekenregels bij (SPEC §5: de regels staan op één plek). De functie
-- legt de toewijzing in een subtransactie vast, leest het resultaat uit toewijzing_uren en
-- toewijzing_dag, en draait de subtransactie daarna ALTIJD terug. Er blijft dus niets
-- achter, ook geen regel in het auditlog.
--
-- SECURITY INVOKER: RLS, de checks en de triggers gelden gewoon. Wie geen toewijzing mag
-- vastleggen (lmc, beheerder, aal1), krijgt dezelfde weigering als bij opslaan. Een
-- ongeldige combinatie geeft dezelfde fout als bij opslaan.

create function public.toewijzing_voorbeeld(
  p_toewijzing_id uuid,
  p_medewerker_id uuid,
  p_werkpakket_id uuid,
  p_schooljaar_id uuid,
  p_bron public.uren_bron,
  p_aandeel_percentage numeric,
  p_aantal_keer integer,
  p_gepland_uitvoering numeric,
  p_gepland_voorbereiding numeric,
  p_gepland_afronding numeric,
  p_verdeling public.verdeling,
  p_looptijd_van date,
  p_looptijd_tot date,
  p_datums date[]
)
returns table (
  uitvoering numeric,
  voorbereiding numeric,
  afronding numeric,
  totaal numeric,
  aantal_dagen integer,
  terugval boolean
)
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_id uuid;
  v_uitvoering numeric;
  v_voorbereiding numeric;
  v_afronding numeric;
  v_totaal numeric;
  v_dagen integer;
  v_terugval boolean;
begin
  begin
    if p_toewijzing_id is null then
      insert into public.toewijzing (
        medewerker_id, werkpakket_id, schooljaar_id, bron, aandeel_percentage, aantal_keer,
        gepland_uitvoering, gepland_voorbereiding, gepland_afronding, verdeling,
        looptijd_van, looptijd_tot
      )
      values (
        p_medewerker_id, p_werkpakket_id, p_schooljaar_id, p_bron,
        coalesce(p_aandeel_percentage, 100), p_aantal_keer,
        p_gepland_uitvoering, p_gepland_voorbereiding, p_gepland_afronding, p_verdeling,
        p_looptijd_van, p_looptijd_tot
      )
      returning id into v_id;
    else
      update public.toewijzing t
      set
        medewerker_id = p_medewerker_id,
        werkpakket_id = p_werkpakket_id,
        bron = p_bron,
        aandeel_percentage = coalesce(p_aandeel_percentage, 100),
        aantal_keer = p_aantal_keer,
        gepland_uitvoering = p_gepland_uitvoering,
        gepland_voorbereiding = p_gepland_voorbereiding,
        gepland_afronding = p_gepland_afronding,
        verdeling = p_verdeling,
        looptijd_van = p_looptijd_van,
        looptijd_tot = p_looptijd_tot
      where t.id = p_toewijzing_id
      returning t.id into v_id;
      if v_id is null then
        raise exception 'Onbekende toewijzing.' using errcode = 'P0002';
      end if;
    end if;

    if p_verdeling = 'op_datum' then
      delete from public.toewijzing_datum where toewijzing_id = v_id;
      insert into public.toewijzing_datum (toewijzing_id, datum)
      select v_id, d from (select distinct unnest(coalesce(p_datums, '{}')) as d) as x;
    end if;

    select u.uitvoering, u.voorbereiding, u.afronding, u.totaal
    into v_uitvoering, v_voorbereiding, v_afronding, v_totaal
    from public.toewijzing_uren u
    where u.toewijzing_id = v_id;

    select count(*) filter (where not td.terugval)::integer, coalesce(bool_or(td.terugval), false)
    into v_dagen, v_terugval
    from public.toewijzing_dag td
    where td.toewijzing_id = v_id;

    -- Altijd terugdraaien: dit is alleen een voorbeeld.
    raise exception using errcode = 'VB001', message = 'voorbeeld terugdraaien';
  exception
    when sqlstate 'VB001' then
      null;
  end;

  return query
  select v_uitvoering, v_voorbereiding, v_afronding, v_totaal, v_dagen, v_terugval;
end
$$;

comment on function public.toewijzing_voorbeeld is
  'Rekenvoorbeeld van een (nog niet opgeslagen) toewijzing met de regels van toewijzing_uren en toewijzing_dag; slaat niets op.';

revoke execute on function public.toewijzing_voorbeeld(
  uuid, uuid, uuid, uuid, public.uren_bron, numeric, integer, numeric, numeric, numeric,
  public.verdeling, date, date, date[]
) from public, anon;

grant execute on function public.toewijzing_voorbeeld(
  uuid, uuid, uuid, uuid, public.uren_bron, numeric, integer, numeric, numeric, numeric,
  public.verdeling, date, date, date[]
) to authenticated;
