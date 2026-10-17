// Teamoverzicht (SPEC §9): per medewerker contracturen, inzetbaar, gepland, resterende
// ruimte, belastingsgraad en zone. Standaard gesorteerd op ruimte: "wie heeft ruimte?".
// Op brede schermen een tabel, op smalle een kaart per medewerker (dezelfde gegevens).
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { naamVan, ophalen, useMedewerkers } from '../beheer/data';
import { SchooljaarKiezer, useSchooljaarKeuze } from '../beheer/SchooljaarKiezer';
import { Knop } from '../components/ui/Knop';
import { LegeStaat } from '../components/ui/Kaart';
import { Laden } from '../components/ui/Laden';
import { Melding } from '../components/ui/Melding';
import { vertaalFout } from '../lib/fouten';
import { formatUren } from '../lib/opmaak';
import { supabase } from '../lib/supabase';
import { useZonegrenzen } from './data';
import {
  filterTeam,
  metContract,
  sorteerTeam,
  teamTotaal,
  ZONENAAM,
  type TeamRij,
  type TeamSortering,
  type ZoneFilter,
} from './logica';
import { ZoneLegenda } from './ZoneLegenda';
import { ZoneWeergave } from './Zone';

const KOLOMMEN: { op: TeamSortering; kop: string; numeriek?: boolean }[] = [
  { op: 'naam', kop: 'Medewerker' },
  { op: 'contracturen', kop: 'Contracturen per week', numeriek: true },
  { op: 'inzetbaar', kop: 'Inzetbaar', numeriek: true },
  { op: 'gepland', kop: 'Gepland', numeriek: true },
  { op: 'ruimte', kop: 'Resterende ruimte', numeriek: true },
  { op: 'belastingsgraad', kop: 'Belasting' },
];

const ZONEFILTERS: { waarde: ZoneFilter; label: string }[] = [
  { waarde: 'alle', label: 'Alle zones' },
  { waarde: 'ruimte', label: ZONENAAM.ruimte },
  { waarde: 'vol', label: ZONENAAM.vol },
  { waarde: 'boven_capaciteit', label: ZONENAAM.boven_capaciteit },
  { waarde: 'geen', label: 'Geen inzetbare uren' },
];

const medewerkers = (n: number) => `${String(n)} ${n === 1 ? 'medewerker' : 'medewerkers'}`;

export function Teamoverzicht() {
  const schooljaar = useSchooljaarKeuze();
  const grenzen = useZonegrenzen(schooljaar);
  const [sortering, setSortering] = useState<{ op: TeamSortering; oplopend: boolean }>({
    op: 'ruimte',
    oplopend: false,
  });
  const [zoek, setZoek] = useState('');
  const [zone, setZone] = useState<ZoneFilter>('alle');
  const lijstMedewerkers = useMedewerkers();
  const belasting = useQuery({
    queryKey: ['belasting', 'team', schooljaar],
    enabled: schooljaar !== null,
    queryFn: () =>
      ophalen(
        supabase()
          .from('belasting_schooljaar')
          .select('*')
          .eq('schooljaar_id', schooljaar ?? ''),
      ),
  });

  const alle = useMemo<TeamRij[]>(() => {
    const naam = new Map((lijstMedewerkers.data ?? []).map((m) => [m.id, naamVan(m)]));
    return metContract(
      (belasting.data ?? []).map((b) => ({
        medewerker_id: b.medewerker_id ?? '',
        naam: naam.get(b.medewerker_id ?? '') ?? 'Medewerker',
        contracturen_per_week: b.contracturen_per_week,
        inzetbaar: b.inzetbaar ?? 0,
        gepland: b.gepland ?? 0,
        ruimte: b.ruimte ?? 0,
        belastingsgraad: b.belastingsgraad,
        zone: b.zone,
      })),
    );
  }, [belasting.data, lijstMedewerkers.data]);

  const rijen = useMemo(
    () => sorteerTeam(filterTeam(alle, zoek, zone), sortering.op, sortering.oplopend),
    [alle, zoek, zone, sortering],
  );
  const totaal = teamTotaal(rijen);
  const gefilterd = zoek.trim() !== '' || zone !== 'alle';

  return (
    <section aria-labelledby="team-titel">
      <h2 id="team-titel">Teamoverzicht</h2>
      <p className="toelichting">
        Wie heeft ruimte voor een nieuwe school, een project of een incidentele activiteit?
        Standaard gesorteerd op resterende ruimte. Alleen medewerkers met een contract in dit
        schooljaar.
      </p>

      <div className="overzicht-balk">
        <SchooljaarKiezer />
        <label className="veld">
          <span className="veld-label">Zoeken op naam</span>
          <input
            type="search"
            value={zoek}
            onChange={(e) => {
              setZoek(e.target.value);
            }}
          />
        </label>
        <label className="veld">
          <span className="veld-label">Zone</span>
          <select
            value={zone}
            onChange={(e) => {
              setZone(e.target.value as ZoneFilter);
            }}
          >
            {ZONEFILTERS.map((z) => (
              <option key={z.waarde} value={z.waarde}>
                {z.label}
              </option>
            ))}
          </select>
        </label>
        {belasting.data ? (
          <p className="telling gedempt" aria-live="polite">
            {gefilterd
              ? `${String(rijen.length)} van ${medewerkers(alle.length)}`
              : medewerkers(alle.length)}
          </p>
        ) : null}
      </div>

      <ZoneLegenda grenzen={grenzen} />

      {belasting.isPending && schooljaar ? <Laden /> : null}
      {belasting.isError ? <Melding soort="fout">{vertaalFout(belasting.error)}</Melding> : null}
      {belasting.data && alle.length === 0 ? (
        <LegeStaat titel="Geen medewerkers met een contract in dit schooljaar">
          Voeg bij Beheer › Medewerkers een contract toe.
        </LegeStaat>
      ) : null}
      {belasting.data && alle.length > 0 && rijen.length === 0 ? (
        <LegeStaat
          titel="Geen medewerkers gevonden"
          actie={
            <Knop
              variant="secundair"
              onClick={() => {
                setZoek('');
                setZone('alle');
              }}
            >
              Filters wissen
            </Knop>
          }
        >
          Er zijn geen medewerkers die passen bij je zoekterm of zone.
        </LegeStaat>
      ) : null}

      {rijen.length > 0 ? (
        <>
          <div className="tabel-schuif tabel-vast teamtabel">
            <table>
              <caption className="verborgen">Teamoverzicht</caption>
              <thead>
                <tr>
                  {KOLOMMEN.map((k) => (
                    <th
                      key={k.op}
                      scope="col"
                      className={k.numeriek ? 'numeriek' : undefined}
                      aria-sort={
                        sortering.op === k.op
                          ? sortering.oplopend
                            ? 'ascending'
                            : 'descending'
                          : undefined
                      }
                    >
                      <button
                        type="button"
                        className="sorteer"
                        onClick={() => {
                          setSortering((s) =>
                            s.op === k.op
                              ? { op: k.op, oplopend: !s.oplopend }
                              : { op: k.op, oplopend: k.op === 'naam' },
                          );
                        }}
                      >
                        {k.kop}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rijen.map((r) => (
                  <tr key={r.medewerker_id}>
                    <th scope="row">
                      <Link to={`/gepland-gerealiseerd/${r.medewerker_id}`}>{r.naam}</Link>
                    </th>
                    <td className="numeriek">{formatUren(r.contracturen_per_week)}</td>
                    <td className="numeriek">{formatUren(r.inzetbaar)}</td>
                    <td className="numeriek">{formatUren(r.gepland)}</td>
                    <td className="numeriek">{formatUren(r.ruimte)}</td>
                    <td>
                      <ZoneWeergave zone={r.zone} graad={r.belastingsgraad} />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row">Totaal ({medewerkers(totaal.aantal)})</th>
                  <td className="numeriek">{formatUren(totaal.contracturen)}</td>
                  <td className="numeriek">{formatUren(totaal.inzetbaar)}</td>
                  <td className="numeriek">{formatUren(totaal.gepland)}</td>
                  <td className="numeriek">{formatUren(totaal.ruimte)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>

          <ul className="teamkaarten" aria-label="Teamoverzicht">
            {rijen.map((r) => (
              <li key={r.medewerker_id} className="teamkaart">
                <h3>
                  <Link to={`/gepland-gerealiseerd/${r.medewerker_id}`}>{r.naam}</Link>
                </h3>
                <TeamGetallen
                  contracturen={r.contracturen_per_week ?? 0}
                  inzetbaar={r.inzetbaar}
                  gepland={r.gepland}
                  ruimte={r.ruimte}
                />
                <ZoneWeergave zone={r.zone} graad={r.belastingsgraad} />
              </li>
            ))}
            <li className="teamkaart teamkaart-totaal">
              <h3>Totaal ({medewerkers(totaal.aantal)})</h3>
              <TeamGetallen {...totaal} />
            </li>
          </ul>
        </>
      ) : null}
    </section>
  );
}

function TeamGetallen(t: {
  contracturen: number;
  inzetbaar: number;
  gepland: number;
  ruimte: number;
}) {
  return (
    <dl>
      <dt>Contracturen per week</dt>
      <dd>{formatUren(t.contracturen)}</dd>
      <dt>Inzetbaar</dt>
      <dd>{formatUren(t.inzetbaar)}</dd>
      <dt>Gepland</dt>
      <dd>{formatUren(t.gepland)}</dd>
      <dt>Resterende ruimte</dt>
      <dd>{formatUren(t.ruimte)}</dd>
    </dl>
  );
}
