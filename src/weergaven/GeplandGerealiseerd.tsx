// Gepland versus gerealiseerd (SPEC §9), per medewerker en schooljaar: per categorie,
// per werkpakket, niet-gekoppelde uren apart, en "tot vandaag". Neutraal: een verschil
// is geen beoordeling.
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import { rechtenVoor } from '../auth/rechten';
import { naamVan, useMedewerkers } from '../beheer/data';
import { SchooljaarKiezer } from '../beheer/SchooljaarKiezer';
import { formatUren } from '../lib/opmaak';
import { haalVergelijking } from './data';
import { nietGekoppeld, perCategorie, perWerkpakket, verschil, type Totaal } from './logica';

function Vergelijktabel({ titel, rijen, kop }: { titel: string; rijen: Totaal[]; kop: string }) {
  return (
    <div className="tabel-schuif">
      <table>
        <caption>{titel}</caption>
        <thead>
          <tr>
            <th scope="col" rowSpan={2}>
              {kop}
            </th>
            <th scope="colgroup" colSpan={3}>
              Hele schooljaar
            </th>
            <th scope="colgroup" colSpan={3}>
              Tot vandaag
            </th>
          </tr>
          <tr>
            <th scope="col" className="numeriek">
              Gepland
            </th>
            <th scope="col" className="numeriek">
              Gerealiseerd
            </th>
            <th scope="col" className="numeriek">
              Verschil
            </th>
            <th scope="col" className="numeriek">
              Gepland
            </th>
            <th scope="col" className="numeriek">
              Gerealiseerd
            </th>
            <th scope="col" className="numeriek">
              Verschil
            </th>
          </tr>
        </thead>
        <tbody>
          {rijen.map((r) => (
            <tr key={r.sleutel}>
              <th scope="row">
                {r.naam}
                {r.sleutel === 'relatiebeheer' && r.gepland === 0 ? (
                  <span className="toelichting"> (niet gepland)</span>
                ) : null}
              </th>
              <td className="numeriek">{formatUren(r.gepland)}</td>
              <td className="numeriek">{formatUren(r.gerealiseerd)}</td>
              <td className="numeriek">{verschil(r.gerealiseerd, r.gepland)}</td>
              <td className="numeriek">{formatUren(r.geplandTot)}</td>
              <td className="numeriek">{formatUren(r.gerealiseerdTot)}</td>
              <td className="numeriek">{verschil(r.gerealiseerdTot, r.geplandTot)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function GeplandGerealiseerd() {
  const { medewerkerId: eigenId, rollen } = useAuth();
  const { medewerkerId: gekozen } = useParams();
  const navigate = useNavigate();
  const rechten = rechtenVoor(rollen);
  const [schooljaar, setSchooljaar] = useState<string | null>(null);
  const medewerkers = useMedewerkers();
  // Een lmc ziet altijd alleen zichzelf (RLS dwingt dat ook af).
  const medewerker = rechten.werkInzien ? (gekozen ?? eigenId) : eigenId;

  const rijen = useQuery({
    queryKey: ['belasting', 'vergelijk', schooljaar, medewerker],
    enabled: schooljaar !== null && medewerker !== null,
    queryFn: () => haalVergelijking(medewerker ?? '', schooljaar ?? ''),
  });

  const data = rijen.data ?? [];
  const los = nietGekoppeld(data);

  return (
    <section aria-labelledby="vergelijk-titel">
      <h2 id="vergelijk-titel">Gepland en gerealiseerd</h2>
      <p className="toelichting">
        Gepland komt uit de toewijzingen; gerealiseerd uit de definitieve MATT-imports. &quot;Tot
        vandaag&quot; vergelijkt het deel van de planning tot vandaag met wat tot vandaag is
        geboekt.
      </p>
      <div className="filters">
        <SchooljaarKiezer waarde={schooljaar} onWijzig={setSchooljaar} />
        {rechten.werkInzien ? (
          <label className="veld">
            <span className="veld-label">Medewerker</span>
            <select
              value={medewerker ?? ''}
              onChange={(e) => {
                void navigate(`/gepland-gerealiseerd/${e.target.value}`);
              }}
            >
              {(medewerkers.data ?? []).map((m) => (
                <option key={m.id} value={m.id}>
                  {naamVan(m)}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {rijen.isPending && schooljaar ? <p aria-busy="true">Bezig met laden…</p> : null}
      {rijen.data ? (
        <>
          <Vergelijktabel titel="Per categorie" kop="Categorie" rijen={perCategorie(data)} />
          {perWerkpakket(data).length > 0 ? (
            <Vergelijktabel titel="Per werkpakket" kop="Werkpakket" rijen={perWerkpakket(data)} />
          ) : (
            <p>Er zijn geen gekoppelde werkpakketten in dit schooljaar.</p>
          )}
          <h3>Niet gekoppeld</h3>
          <p>
            Uren op MATT-projecten die nog niet aan een werkpakket zijn gekoppeld:{' '}
            <strong>{formatUren(los.gerealiseerd)} uur</strong>
            {los.gerealiseerd > 0 && rechten.mattProjecten ? (
              <>
                {' '}
                (<Link to="/beheer/matt-projecten">MATT-projecten koppelen</Link>)
              </>
            ) : null}
            .
          </p>
        </>
      ) : null}
    </section>
  );
}
