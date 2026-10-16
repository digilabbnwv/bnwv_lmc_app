-- Weergaven (SPEC §9): gepland versus gerealiseerd per medewerker en schooljaar.
-- SECURITY INVOKER: RLS geldt, dus een lmc krijgt alleen de eigen cijfers.

-- Per werkpakket en categorie: gepland, gepland tot de peildatum (op basis van de
-- dagverdeling), gerealiseerd (definitieve imports, zonder genegeerde projecten) en
-- gerealiseerd tot de peildatum. werkpakket_id leeg = MATT-project zonder werkpakket.
-- categorie leeg = artikelcode zonder categorie. Voor relatiebeheer bestaan geen
-- geplande uren (SPEC §5); gepland is daar 0.
create function public.gepland_vs_gerealiseerd(
  p_medewerker_id uuid,
  p_schooljaar_id uuid,
  p_peildatum date default current_date
)
returns table (
  werkpakket_id uuid,
  werkpakket_naam text,
  werkpakket_soort public.werkpakket_soort,
  categorie public.boeking_categorie,
  gepland numeric,
  gepland_tot_peildatum numeric,
  gerealiseerd numeric,
  gerealiseerd_tot_peildatum numeric
)
language sql
stable
set search_path = ''
as $$
  with sj as (
    select s.startdatum, s.einddatum from public.schooljaar s where s.id = p_schooljaar_id
  ),
  gepland as (
    select d.werkpakket_id, c.categorie,
      sum(c.uren) as uren,
      sum(c.uren) filter (where d.datum <= p_peildatum) as uren_tot
    from public.toewijzing_dag d
    cross join lateral (
      values
        ('uitvoering'::public.boeking_categorie, d.uitvoering),
        ('voorbereiding_afronding'::public.boeking_categorie, d.voorbereiding + d.afronding)
    ) as c (categorie, uren)
    where d.medewerker_id = p_medewerker_id and d.schooljaar_id = p_schooljaar_id
    group by d.werkpakket_id, c.categorie
  ),
  gerealiseerd as (
    select g.werkpakket_id, g.categorie,
      sum(g.uren) as uren,
      sum(g.uren) filter (where g.datum <= p_peildatum) as uren_tot
    from public.gerealiseerd g, sj
    where g.medewerker_id = p_medewerker_id and g.datum between sj.startdatum and sj.einddatum
    group by g.werkpakket_id, g.categorie
  ),
  -- GROUP BY behandelt een leeg werkpakket of een lege categorie als gelijk.
  samen as (
    select x.werkpakket_id, x.categorie,
      sum(x.gepland) as gepland,
      sum(x.gepland_tot) as gepland_tot_peildatum,
      sum(x.gerealiseerd) as gerealiseerd,
      sum(x.gerealiseerd_tot) as gerealiseerd_tot_peildatum
    from (
      select p.werkpakket_id, p.categorie, p.uren as gepland, coalesce(p.uren_tot, 0) as gepland_tot,
        0 as gerealiseerd, 0 as gerealiseerd_tot
      from gepland p
      union all
      select r.werkpakket_id, r.categorie, 0, 0, r.uren, coalesce(r.uren_tot, 0)
      from gerealiseerd r
    ) as x
    group by x.werkpakket_id, x.categorie
  )
  select s.werkpakket_id, w.naam, w.soort, s.categorie,
    s.gepland, s.gepland_tot_peildatum, s.gerealiseerd, s.gerealiseerd_tot_peildatum
  from samen s
  left join public.werkpakket w on w.id = s.werkpakket_id
  where exists (select 1 from public.medewerker m where m.id = p_medewerker_id)
  order by w.naam nulls last, s.categorie nulls last
$$;

revoke execute on function public.gepland_vs_gerealiseerd(uuid, uuid, date) from public, anon;
grant execute on function public.gepland_vs_gerealiseerd(uuid, uuid, date) to authenticated, service_role;
