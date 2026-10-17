// Mijn belasting (SPEC §9): inzetbaar, gepland en gerealiseerd voor het gekozen
// schooljaar, de belastingsgraad met zone, en de toewijzingen.
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import { BRONNAAM, ophalen, useWerkpakketten, VERDELINGNAAM } from '../beheer/data';
import { SchooljaarKiezer, useSchooljaarKeuze } from '../beheer/SchooljaarKiezer';
import { formatDatum, formatUren } from '../lib/opmaak';
import { supabase } from '../lib/supabase';
import { haalVergelijking } from './data';
import { ZoneWeergave } from './Zone';

function Kerngetal({
  label,
  waarde,
  toelichting,
}: {
  label: string;
  waarde: string;
  toelichting?: string;
}) {
  return (
    <div className="kerngetal">
      <dt>{label}</dt>
      <dd>
        <span className="kerngetal-waarde">{waarde}</span>
        {toelichting ? <span className="toelichting"> {toelichting}</span> : null}
      </dd>
    </div>
  );
}

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

  const b = belasting.data;
  const gerealiseerd = (vergelijk.data ?? []).reduce((t, r) => t + r.gerealiseerd, 0);

  return (
    <section aria-labelledby="mijn-titel">
      <h2 id="mijn-titel">Mijn belasting</h2>
      <SchooljaarKiezer />
      {medewerkerId === null ? <p>Je account is niet aan een medewerker gekoppeld.</p> : null}
      {belasting.isPending && schooljaar ? <p aria-busy="true">Bezig met laden…</p> : null}
      {b ? (
        <>
          <dl className="kerngetallen">
            <Kerngetal label="Inzetbaar" waarde={formatUren(b.inzetbaar)} toelichting="uur" />
            <Kerngetal label="Gepland" waarde={formatUren(b.gepland)} toelichting="uur" />
            <Kerngetal
              label="Gerealiseerd (MATT)"
              waarde={formatUren(gerealiseerd)}
              toelichting="uur"
            />
            <Kerngetal label="Resterende ruimte" waarde={formatUren(b.ruimte)} toelichting="uur" />
          </dl>
          <p>
            Belastingsgraad: <ZoneWeergave zone={b.zone} graad={b.belastingsgraad} />
          </p>
          <p>
            <Link to="/gepland-gerealiseerd">
              Gepland en gerealiseerd per categorie en werkpakket
            </Link>
          </p>
        </>
      ) : schooljaar && belasting.isSuccess ? (
        <p>Voor dit schooljaar zijn er geen gegevens.</p>
      ) : null}

      <h3>Mijn toewijzingen</h3>
      {toewijzingen.data && toewijzingen.data.length > 0 ? (
        <div className="tabel-schuif">
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
        </div>
      ) : (
        <p>Er zijn nog geen toewijzingen in dit schooljaar.</p>
      )}

      {perMaand.data && perMaand.data.length > 0 ? (
        <>
          <h3>Per maand</h3>
          <div className="tabel-schuif">
            <table>
              <caption className="verborgen">Inzetbaar en gepland per maand</caption>
              <thead>
                <tr>
                  <th scope="col">Maand</th>
                  <th scope="col" className="numeriek">
                    Inzetbaar
                  </th>
                  <th scope="col" className="numeriek">
                    Gepland
                  </th>
                  <th scope="col">Belasting</th>
                </tr>
              </thead>
              <tbody>
                {perMaand.data.map((m) => (
                  <tr key={m.periode_van}>
                    <td>
                      {new Date(m.periode_van).toLocaleDateString('nl-NL', {
                        month: 'long',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="numeriek">{formatUren(m.inzetbaar)}</td>
                    <td className="numeriek">{formatUren(m.gepland)}</td>
                    <td>
                      <ZoneWeergave zone={m.zone} graad={m.belastingsgraad} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </section>
  );
}
