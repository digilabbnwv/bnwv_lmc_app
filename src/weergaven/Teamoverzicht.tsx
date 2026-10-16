// Teamoverzicht (SPEC §9): per medewerker contracturen, inzetbaar, gepland, resterende
// ruimte, belastingsgraad en zone. Standaard gesorteerd op ruimte: "wie heeft ruimte?".
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { naamVan, ophalen, useMedewerkers } from '../beheer/data';
import { SchooljaarKiezer } from '../beheer/SchooljaarKiezer';
import { formatUren } from '../lib/opmaak';
import { supabase } from '../lib/supabase';
import { metContract, sorteerTeam, type TeamRij, type TeamSortering } from './logica';
import { ZoneWeergave } from './Zone';

const KOLOMMEN: { op: TeamSortering; kop: string; numeriek?: boolean }[] = [
  { op: 'naam', kop: 'Medewerker' },
  { op: 'contracturen', kop: 'Contracturen per week', numeriek: true },
  { op: 'inzetbaar', kop: 'Inzetbaar', numeriek: true },
  { op: 'gepland', kop: 'Gepland', numeriek: true },
  { op: 'ruimte', kop: 'Resterende ruimte', numeriek: true },
  { op: 'belastingsgraad', kop: 'Belasting' },
];

export function Teamoverzicht() {
  const [schooljaar, setSchooljaar] = useState<string | null>(null);
  const [sortering, setSortering] = useState<{ op: TeamSortering; oplopend: boolean }>({
    op: 'ruimte',
    oplopend: false,
  });
  const medewerkers = useMedewerkers();
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

  const rijen = useMemo<TeamRij[]>(() => {
    const naam = new Map((medewerkers.data ?? []).map((m) => [m.id, naamVan(m)]));
    const lijst = (belasting.data ?? []).map((b) => ({
      medewerker_id: b.medewerker_id ?? '',
      naam: naam.get(b.medewerker_id ?? '') ?? 'Medewerker',
      contracturen_per_week: b.contracturen_per_week,
      inzetbaar: b.inzetbaar ?? 0,
      gepland: b.gepland ?? 0,
      ruimte: b.ruimte ?? 0,
      belastingsgraad: b.belastingsgraad,
      zone: b.zone,
    }));
    return sorteerTeam(metContract(lijst), sortering.op, sortering.oplopend);
  }, [belasting.data, medewerkers.data, sortering]);

  return (
    <section aria-labelledby="team-titel">
      <h2 id="team-titel">Teamoverzicht</h2>
      <p className="toelichting">
        Wie heeft ruimte voor een nieuwe school, een project of een incidentele activiteit?
        Standaard gesorteerd op resterende ruimte. Alleen medewerkers met een contract in dit
        schooljaar.
      </p>
      <SchooljaarKiezer waarde={schooljaar} onWijzig={setSchooljaar} />
      {belasting.isPending && schooljaar ? <p aria-busy="true">Bezig met laden…</p> : null}
      {belasting.data ? (
        <div className="tabel-schuif">
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
              {rijen.length === 0 ? (
                <tr>
                  <td colSpan={KOLOMMEN.length}>
                    Geen medewerkers met een contract in dit schooljaar.
                  </td>
                </tr>
              ) : (
                rijen.map((r) => (
                  <tr key={r.medewerker_id}>
                    <td>
                      <Link to={`/gepland-gerealiseerd/${r.medewerker_id}`}>{r.naam}</Link>
                    </td>
                    <td className="numeriek">{formatUren(r.contracturen_per_week)}</td>
                    <td className="numeriek">{formatUren(r.inzetbaar)}</td>
                    <td className="numeriek">{formatUren(r.gepland)}</td>
                    <td className="numeriek">{formatUren(r.ruimte)}</td>
                    <td>
                      <ZoneWeergave zone={r.zone} graad={r.belastingsgraad} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
