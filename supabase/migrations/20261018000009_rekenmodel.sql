-- Rekenmodel (SPEC §5): capaciteit en geplande belasting per werkdag; de weergaven
-- tellen op per week, maand of schooljaar. Alle functies en views zijn SECURITY
-- INVOKER, zodat RLS geldt: een lmc ziet alleen de eigen cijfers.
-- Rekenen in numeric; afronden gebeurt pas in de weergave.

-- ---------------------------------------------------------------------------
-- Hulpfuncties
-- ---------------------------------------------------------------------------

-- Alle werkdagen (ma-vr) van p_van t/m p_tot. Feestdagen worden hier NIET weggelaten.
create function private.werkdagen(p_van date, p_tot date)
returns setof date
language sql
immutable
parallel safe
set search_path = ''
as $$
  select d::date
  from generate_series(p_van::timestamp, p_tot::timestamp, interval '1 day') as d
  where extract(isodow from d) < 6
$$;

-- Aantal werkdagen (ma-vr) in een kalenderjaar; noemer voor de vakantie-uren.
create function private.werkdagen_in_jaar(p_jaar integer)
returns integer
language sql
immutable
parallel safe
set search_path = ''
as $$
  select count(*)::integer
  from private.werkdagen(make_date(p_jaar, 1, 1), make_date(p_jaar, 12, 31))
$$;

-- Numerieke instelling die op p_datum geldt (laatste ingangsdatum <= p_datum).
create function private.instelling_op(p_sleutel text, p_datum date)
returns numeric
language sql
stable
set search_path = ''
as $$
  select i.waarde::numeric
  from public.instelling i
  where i.sleutel = p_sleutel and i.ingangsdatum <= p_datum
  order by i.ingangsdatum desc
  limit 1
$$;

-- Signaalzone (SPEC §5): ruimte < grens_vol <= vol <= grens_boven_capaciteit < boven.
-- Neutrale labels; geen beoordeling.
create function private.signaalzone(p_graad numeric, p_grens_vol numeric, p_grens_boven numeric)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case
    when p_graad is null or p_grens_vol is null or p_grens_boven is null then null
    when p_graad * 100 < p_grens_vol then 'ruimte'
    when p_graad * 100 <= p_grens_boven then 'vol'
    else 'boven_capaciteit'
  end
$$;

revoke execute on function
  private.werkdagen(date, date),
  private.werkdagen_in_jaar(integer),
  private.instelling_op(text, date),
  private.signaalzone(numeric, numeric, numeric)
from public, anon;

grant execute on function
  private.werkdagen(date, date),
  private.werkdagen_in_jaar(integer),
  private.instelling_op(text, date),
  private.signaalzone(numeric, numeric, numeric)
to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Capaciteit per werkdag
-- ---------------------------------------------------------------------------

-- Per werkdag van één medewerker:
--   bruto     = 0 op een feestdag, anders (contracturen/week ÷ 5) × beschikbaarheid ÷ 100
--   vakantie  = vakantie-uren van het kalenderjaar ÷ werkdagen in dat kalenderjaar
--               (som over een schooljaar = het deel naar rato van de werkdagen, SPEC §5)
--   netto     = bruto − vakantie
--   inzetbaar = netto × (1 − overhead ÷ 100), met de overhead die op die dag geldt
-- Geeft niets terug als de medewerker niet zichtbaar is (RLS).
create function public.capaciteit_per_dag(p_medewerker_id uuid, p_van date, p_tot date)
returns table (
  datum date,
  contracturen_dag numeric,
  beschikbaarheid numeric,
  feestdag boolean,
  bruto numeric,
  vakantie numeric,
  netto numeric,
  overhead_percentage numeric,
  inzetbaar numeric
)
language sql
stable
set search_path = ''
as $$
  with dag as (
    select
      w.datum,
      coalesce((
        select c.uren_per_week
        from public.contract c
        where c.medewerker_id = p_medewerker_id
          and w.datum >= c.geldig_van
          and (c.geldig_tot is null or w.datum <= c.geldig_tot)
      ), 0) / 5 as contracturen_dag,
      coalesce((
        select nb.beschikbaarheidspercentage
        from public.niet_beschikbaar nb
        where nb.medewerker_id = p_medewerker_id and w.datum between nb.van and nb.tot
      ), 100) as beschikbaarheid,
      exists (select 1 from public.feestdag f where f.datum = w.datum) as feestdag,
      coalesce((
        select v.uren
        from public.vakantie_uren v
        where v.medewerker_id = p_medewerker_id
          and v.kalenderjaar = extract(year from w.datum)::integer
      ), 0) / private.werkdagen_in_jaar(extract(year from w.datum)::integer) as vakantie,
      coalesce(private.instelling_op('overhead_percentage', w.datum), 0) as overhead_percentage
    from private.werkdagen(p_van, p_tot) as w (datum)
    where exists (select 1 from public.medewerker m where m.id = p_medewerker_id)
  ),
  bruto as (
    select d.*,
      case when d.feestdag then 0 else d.contracturen_dag * d.beschikbaarheid / 100 end as bruto
    from dag d
  )
  select
    b.datum,
    b.contracturen_dag,
    b.beschikbaarheid,
    b.feestdag,
    b.bruto,
    b.vakantie,
    b.bruto - b.vakantie as netto,
    b.overhead_percentage,
    (b.bruto - b.vakantie) * (1 - b.overhead_percentage / 100) as inzetbaar
  from bruto b
  order by b.datum
$$;

-- ---------------------------------------------------------------------------
-- Geplande uren per toewijzing
-- ---------------------------------------------------------------------------

-- Totale uren per toewijzing en categorie (SPEC §5):
--   staffel:       uitvoering = staffeluren × aandeel; voorbereiding = staffeluren × aandeel ×
--                  (opslagfactor − 1). Staffeluren = uren_handmatig of de staffel bij het aantal
--                  leerlingen. In de vergelijking met MATT tellen voorbereiding en afronding samen.
--   norm_x_aantal: aantal_keer × normuren per categorie van het activiteittype.
--   handmatig:     de ingevoerde uren.
create view public.toewijzing_uren
with (security_invoker = true)
as
select
  t.id as toewijzing_id,
  t.medewerker_id,
  t.werkpakket_id,
  t.schooljaar_id,
  t.bron,
  t.verdeling,
  u.uitvoering,
  u.voorbereiding,
  u.afronding,
  u.uitvoering + u.voorbereiding + u.afronding as totaal
from public.toewijzing t
left join public.werkpakket w on w.id = t.werkpakket_id
left join public.activiteittype a on a.id = w.activiteittype_id
left join lateral (
  select
    coalesce(ss.uren_handmatig, sf.uren, 0) * t.aandeel_percentage / 100 as staffeluren,
    coalesce(o.factor, 1) as factor
  from public.school s
  left join public.school_schooljaar ss
    on ss.school_id = s.werkpakket_id and ss.schooljaar_id = t.schooljaar_id
  left join public.staffel sf
    on sf.schooljaar_id = t.schooljaar_id
    and sf.schooltype = s.schooltype
    and ss.aantal_leerlingen >= sf.leerlingen_min
    and (sf.leerlingen_max is null or ss.aantal_leerlingen <= sf.leerlingen_max)
  left join public.opslagfactor o
    on o.schooljaar_id = t.schooljaar_id and o.schooltype = s.schooltype
  where s.werkpakket_id = t.werkpakket_id
) st on t.bron = 'staffel'
cross join lateral (
  select
    coalesce(case t.bron
      when 'handmatig' then t.gepland_uitvoering
      when 'norm_x_aantal' then t.aantal_keer * a.normuren_uitvoering
      when 'staffel' then st.staffeluren
    end, 0) as uitvoering,
    coalesce(case t.bron
      when 'handmatig' then t.gepland_voorbereiding
      when 'norm_x_aantal' then t.aantal_keer * a.normuren_voorbereiding
      when 'staffel' then st.staffeluren * (st.factor - 1)
    end, 0) as voorbereiding,
    coalesce(case t.bron
      when 'handmatig' then t.gepland_afronding
      when 'norm_x_aantal' then t.aantal_keer * a.normuren_afronding
      else 0
    end, 0) as afronding
) u;

-- Geplande uren per toewijzing per dag. Verdeling (SPEC §5):
--   schoolweken: werkdagen van het schooljaar zonder feestdagen en zonder schoolvakanties
--   looptijd:    werkdagen van van t/m tot zonder feestdagen (schoolvakanties tellen mee)
--   op_datum:    de opgegeven datums
-- Zijn er geen geschikte dagen, dan komen de uren op de eerste dag (terugval = true),
-- zodat er geen uren verloren gaan.
create view public.toewijzing_dag
with (security_invoker = true)
as
with kandidaat as (
  select t.id as toewijzing_id, d.datum
  from public.toewijzing t
  join public.schooljaar sj on sj.id = t.schooljaar_id
  cross join lateral (
    select w.datum
    from private.werkdagen(sj.startdatum, sj.einddatum) as w (datum)
    where t.verdeling = 'schoolweken'
      and not exists (select 1 from public.feestdag f where f.datum = w.datum)
      and not exists (
        select 1 from public.schoolvakantie sv
        where sv.schooljaar_id = sj.id and w.datum between sv.van and sv.tot
      )
    union all
    select w.datum
    from private.werkdagen(t.looptijd_van, t.looptijd_tot) as w (datum)
    where t.verdeling = 'looptijd'
      and not exists (select 1 from public.feestdag f where f.datum = w.datum)
    union all
    select td.datum
    from public.toewijzing_datum td
    where t.verdeling = 'op_datum' and td.toewijzing_id = t.id
  ) d
),
dagen as (
  select k.toewijzing_id, k.datum, false as terugval from kandidaat k
  union all
  select t.id, coalesce(t.looptijd_van, sj.startdatum), true
  from public.toewijzing t
  join public.schooljaar sj on sj.id = t.schooljaar_id
  where not exists (select 1 from kandidaat k where k.toewijzing_id = t.id)
),
telling as (
  select d.toewijzing_id, count(*) as aantal from dagen d group by d.toewijzing_id
)
select
  u.toewijzing_id,
  u.medewerker_id,
  u.werkpakket_id,
  u.schooljaar_id,
  d.datum,
  d.terugval,
  u.uitvoering / tl.aantal as uitvoering,
  u.voorbereiding / tl.aantal as voorbereiding,
  u.afronding / tl.aantal as afronding,
  u.totaal / tl.aantal as totaal
from dagen d
join telling tl on tl.toewijzing_id = d.toewijzing_id
join public.toewijzing_uren u on u.toewijzing_id = d.toewijzing_id;

-- ---------------------------------------------------------------------------
-- Belasting
-- ---------------------------------------------------------------------------

-- Capaciteit, geplande belasting en signaalzone per zichtbare medewerker over een periode.
-- Belastingsgraad = gepland ÷ inzetbaar (leeg als er geen inzetbare uren zijn).
-- De signaalgrenzen zijn die op de eerste dag van de periode.
create function public.belasting(p_van date, p_tot date)
returns table (
  medewerker_id uuid,
  contracturen_per_week numeric,
  bruto numeric,
  vakantie numeric,
  netto numeric,
  inzetbaar numeric,
  gepland numeric,
  gepland_uitvoering numeric,
  gepland_voorbereiding_afronding numeric,
  ruimte numeric,
  belastingsgraad numeric,
  zone text
)
language sql
stable
set search_path = ''
as $$
  with capaciteit as (
    select
      m.id as medewerker_id,
      coalesce(sum(c.bruto), 0) as bruto,
      coalesce(sum(c.vakantie), 0) as vakantie,
      coalesce(sum(c.netto), 0) as netto,
      coalesce(sum(c.inzetbaar), 0) as inzetbaar
    from public.medewerker m
    left join lateral public.capaciteit_per_dag(m.id, p_van, p_tot) c on true
    group by m.id
  ),
  gepland as (
    select
      td.medewerker_id,
      sum(td.uitvoering) as uitvoering,
      sum(td.voorbereiding + td.afronding) as voorbereiding_afronding,
      sum(td.totaal) as totaal
    from public.toewijzing_dag td
    where td.datum between p_van and p_tot
    group by td.medewerker_id
  ),
  grens as (
    select
      private.instelling_op('grens_vol', p_van) as vol,
      private.instelling_op('grens_boven_capaciteit', p_van) as boven
  ),
  totaal as (
    select
      c.*,
      (
        select ct.uren_per_week from public.contract ct
        where ct.medewerker_id = c.medewerker_id
          and p_van >= ct.geldig_van and (ct.geldig_tot is null or p_van <= ct.geldig_tot)
      ) as contracturen_per_week,
      coalesce(g.totaal, 0) as gepland,
      coalesce(g.uitvoering, 0) as gepland_uitvoering,
      coalesce(g.voorbereiding_afronding, 0) as gepland_voorbereiding_afronding,
      case when c.inzetbaar > 0 then coalesce(g.totaal, 0) / c.inzetbaar end as belastingsgraad
    from capaciteit c
    left join gepland g on g.medewerker_id = c.medewerker_id
  )
  select
    t.medewerker_id,
    t.contracturen_per_week,
    t.bruto,
    t.vakantie,
    t.netto,
    t.inzetbaar,
    t.gepland,
    t.gepland_uitvoering,
    t.gepland_voorbereiding_afronding,
    t.inzetbaar - t.gepland as ruimte,
    t.belastingsgraad,
    private.signaalzone(t.belastingsgraad, gr.vol, gr.boven) as zone
  from totaal t
  cross join grens gr
  where p_van <= p_tot
$$;

-- Belasting per medewerker per schooljaar (basis voor het teamoverzicht).
create view public.belasting_schooljaar
with (security_invoker = true)
as
select sj.id as schooljaar_id, sj.naam as schooljaar, b.*
from public.schooljaar sj
cross join lateral public.belasting(sj.startdatum, sj.einddatum) b;

-- Belasting per week (ISO, maandag) of per maand binnen een schooljaar. De eerste en
-- laatste periode worden afgekapt op het schooljaar.
create function public.belasting_per_periode(p_schooljaar_id uuid, p_eenheid text)
returns table (
  periode_van date,
  periode_tot date,
  medewerker_id uuid,
  inzetbaar numeric,
  gepland numeric,
  ruimte numeric,
  belastingsgraad numeric,
  zone text
)
language plpgsql
stable
set search_path = ''
as $$
begin
  if p_eenheid not in ('week', 'maand') then
    raise exception 'Eenheid moet week of maand zijn.' using errcode = '22023';
  end if;
  return query
    with sj as (select s.startdatum, s.einddatum from public.schooljaar s where s.id = p_schooljaar_id),
    periode as (
      select
        greatest(p.periode_begin::date, sj.startdatum) as van,
        least(
          (p.periode_begin + case p_eenheid when 'week' then interval '1 week' else interval '1 month' end
            - interval '1 day')::date,
          sj.einddatum
        ) as tot
      from sj
      cross join lateral generate_series(
        date_trunc(case p_eenheid when 'week' then 'week' else 'month' end, sj.startdatum::timestamp),
        sj.einddatum::timestamp,
        case p_eenheid when 'week' then interval '1 week' else interval '1 month' end
      ) as p (periode_begin)
    )
    select per.van, per.tot, b.medewerker_id, b.inzetbaar, b.gepland, b.ruimte,
      b.belastingsgraad, b.zone
    from periode per
    cross join lateral public.belasting(per.van, per.tot) b
    order by per.van, b.medewerker_id;
end
$$;

-- ---------------------------------------------------------------------------
-- Rechten
-- ---------------------------------------------------------------------------

revoke all on table public.toewijzing_uren, public.toewijzing_dag, public.belasting_schooljaar
from public, anon;
grant select on table public.toewijzing_uren, public.toewijzing_dag, public.belasting_schooljaar
to authenticated, service_role;

revoke execute on function
  public.capaciteit_per_dag(uuid, date, date),
  public.belasting(date, date),
  public.belasting_per_periode(uuid, text)
from public, anon;

grant execute on function
  public.capaciteit_per_dag(uuid, date, date),
  public.belasting(date, date),
  public.belasting_per_periode(uuid, text)
to authenticated, service_role;
