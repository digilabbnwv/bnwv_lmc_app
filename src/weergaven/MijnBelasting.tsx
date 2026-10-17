// Mijn belasting (SPEC §9): inzetbaar, gepland en gerealiseerd voor het gekozen
// schooljaar, de belastingsgraad met zone, en de toewijzingen.
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import { BRONNAAM, ophalen, useWerkpakketten, VERDELINGNAAM } from '../beheer/data';
import { SchooljaarKiezer, useSchooljaarKeuze } from '../beheer/SchooljaarKiezer';
import { Kaart, LegeStaat } from '../components/ui/Kaart';
import { Kerngetal, Kerngetallen } from '../components/ui/Kerngetal';
import { Laden } from '../components/ui/Laden';
import { Melding } from '../components/ui/Melding';
import { vertaalFout } from '../lib/fouten';
import { formatDatum, formatUren } from '../lib/opmaak';
import { supabase } from '../lib/supabase';
import { haalVergelijking, useZonegrenzen } from './data';
import { MaandGrafiek } from './MaandGrafiek';
import { ZoneLegenda } from './ZoneLegenda';
import { ZoneWeergave } from './Zone';
import { TabelVak } from '../components/ui/TabelVak';

/** Uitleg bij de kerngetallen (SPEC §5), in gewone taal. */
const UITLEG = {
  inzetbaar:
    'Je contracturen over de werkdagen van het schooljaar, zonder feestdagen en rekening houdend met je beschikbaarheid. Daar gaan je vakantie-uren af, en daarna een vast percentage voor overhead.',
  gepland:
    'De uren van je toewijzingen in dit schooljaar: scholen (staffeluren × opslagfactor), activiteiten (aantal keer × normuren) en projecten (de toegewezen uren).',
  gerealiseerd: 'De uren die je in MATT hebt geboekt, uit de definitieve imports.',
  ruimte:
    'Inzetbaar min gepland. Een negatief getal betekent dat er meer gepland is dan er inzetbaar is.',
};

export function MijnBelasting() {
  const { medewerkerId } = useAuth();
  const schooljaar = useSchooljaarKeuze();
  const werkpakketten = useWerkpakketten();
  const pakketNaam = new Map((werkpakketten.data ?? []).map((w) => [w.id, w.naam]));

  const belasting = useQuery({
    queryKey: ['belasting', 'mijn', schooljaar, medewerkerId],
    enabled: schooljaar !== null && medewerkerId !== null,
    queryFn: async () => {
      const { data, error } = await supabase()
        .from('belasting_schooljaar')
        .select('*')
        .eq('schooljaar_id', schooljaar ?? '')
        .eq('medewerker_id', medewerkerId ?? '')
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const vergelijk = useQuery({
    queryKey: ['belasting', 'vergelijk', schooljaar, medewerkerId],
    enabled: schooljaar !== null && medewerkerId !== null,
    queryFn: () => haalVergelijking(medewerkerId ?? '', schooljaar ?? ''),
  });

  const toewijzingen = useQuery({
    queryKey: ['belasting', 'toewijzingen', schooljaar, medewerkerId],
    enabled: schooljaar !== null && medewerkerId !== null,
    queryFn: async () => {
      const [uren, details] = await Promise.all([
        ophalen(
          supabase()
            .from('toewijzing_uren')
            .select('toewijzing_id, werkpakket_id, bron, verdeling, totaal')
            .eq('schooljaar_id', schooljaar ?? '')
            .eq('medewerker_id', medewerkerId ?? ''),
        ),
        ophalen(
          supabase()
            .from('toewijzing')
            .select('id, looptijd_van, looptijd_tot')
            .eq('schooljaar_id', schooljaar ?? '')
            .eq('medewerker_id', medewerkerId ?? ''),
        ),
      ]);
      const looptijd = new Map(details.map((d) => [d.id, d]));
      return uren.map((u) => ({ ...u, looptijd: looptijd.get(u.toewijzing_id ?? '') }));
    },
  });

  const perMaand = useQuery({
    queryKey: ['belasting', 'maand', schooljaar, medewerkerId],
    enabled: schooljaar !== null && medewerkerId !== null,
    queryFn: async () => {
      const rijen = await ophalen(
        supabase().rpc('belasting_per_periode', {
          p_schooljaar_id: schooljaar ?? '',
          p_eenheid: 'maand',
        }),
      );
      return rijen.filter((r) => r.medewerker_id === medewerkerId);
    },
  });

  const grenzen = useZonegrenzen(schooljaar);
  const b = belasting.data;
  const gerealiseerd = (vergelijk.data ?? []).reduce((t, r) => t + r.gerealiseerd, 0);

  return (
    <section aria-labelledby="mijn-titel">
      <h2 id="mijn-titel">Mijn belasting</h2>
      <div className="overzicht-balk">
        <SchooljaarKiezer />
      </div>
      {medewerkerId === null ? (
        <Melding soort="let-op" titel="Geen medewerker gekoppeld">
          Je account is niet aan een medewerker gekoppeld. Vraag een manager of beheerder om dat te
          doen.
        </Melding>
      ) : null}
      {belasting.isPending && schooljaar && medewerkerId ? <Laden /> : null}
      {belasting.isError ? <Melding soort="fout">{vertaalFout(belasting.error)}</Melding> : null}
      {b ? (
        <>
          <Kerngetallen>
            <Kerngetal
              label="Inzetbaar"
              waarde={formatUren(b.inzetbaar)}
              eenheid="uur"
              uitleg={UITLEG.inzetbaar}
            />
            <Kerngetal
              label="Gepland"
              waarde={formatUren(b.gepland)}
              eenheid="uur"
              uitleg={UITLEG.gepland}
            />
            <Kerngetal
              label="Gerealiseerd (MATT)"
              waarde={formatUren(gerealiseerd)}
              eenheid="uur"
              uitleg={UITLEG.gerealiseerd}
            />
            <Kerngetal
              label="Resterende ruimte"
              waarde={formatUren(b.ruimte)}
              eenheid="uur"
              uitleg={UITLEG.ruimte}
            />
          </Kerngetallen>
          <Kaart titel="Belasting">
            <div className="belasting-blok">
              <ZoneWeergave zone={b.zone} graad={b.belastingsgraad} />
              <ZoneLegenda grenzen={grenzen} />
            </div>
          </Kaart>
          <p>
            <Link to="/gepland-gerealiseerd">
              Gepland en gerealiseerd per categorie en werkpakket
            </Link>
          </p>
        </>
      ) : schooljaar && belasting.isSuccess ? (
        <LegeStaat titel="Geen gegevens voor dit schooljaar">
          Er is voor dit schooljaar nog geen contract of planning.
        </LegeStaat>
      ) : null}

      <h3>Mijn toewijzingen</h3>
      {toewijzingen.data && toewijzingen.data.length > 0 ? (
        <TabelVak label="Mijn toewijzingen">
          <table>
            <caption className="verborgen">Mijn toewijzingen</caption>
            <thead>
              <tr>
                <th scope="col">Werkpakket</th>
                <th scope="col">Bron</th>
                <th scope="col">Verdeling</th>
                <th scope="col" className="numeriek">
                  Uren
                </th>
              </tr>
            </thead>
            <tbody>
              {toewijzingen.data.map((t) => (
                <tr key={t.toewijzing_id}>
                  <td>{pakketNaam.get(t.werkpakket_id ?? '') ?? ''}</td>
                  <td>{t.bron ? BRONNAAM[t.bron] : ''}</td>
                  <td>
                    {t.verdeling ? VERDELINGNAAM[t.verdeling] : ''}
                    {t.looptijd?.looptijd_van
                      ? ` (${formatDatum(t.looptijd.looptijd_van)} – ${formatDatum(t.looptijd.looptijd_tot)})`
                      : ''}
                  </td>
                  <td className="numeriek">{formatUren(t.totaal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TabelVak>
      ) : (
        <LegeStaat titel="Nog geen toewijzingen">
          Er zijn in dit schooljaar nog geen werkpakketten aan je toegewezen.
        </LegeStaat>
      )}

      {perMaand.data && perMaand.data.length > 0 ? (
        <>
          <h3>Per maand</h3>
          <MaandGrafiek rijen={perMaand.data} />
        </>
      ) : null}
    </section>
  );
}
