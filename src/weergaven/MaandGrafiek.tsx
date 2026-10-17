// Inzetbaar en gepland per maand als eenvoudige SVG-staafgrafiek, zonder bibliotheek.
// Neutraal (SPEC §1): alleen grijstinten. Inzetbaar is een omlijnde staaf, gepland een
// gevulde; boven capaciteit is gearceerd. Zo is niets alleen aan kleur te herkennen.
// De tabel eronder is het volledige alternatief (WCAG 1.1.1).
import { useId } from 'react';
import { formatPercentage, formatUren } from '../lib/opmaak';
import { asSchaal, zoneLabel } from './logica';
import { ZoneWeergave } from './Zone';
import { TabelVak } from '../components/ui/TabelVak';

export interface MaandRij {
  periode_van: string;
  inzetbaar: number;
  gepland: number;
  belastingsgraad: number | null;
  zone: string | null;
}

const BREED = 720;
const HOOG = 240;
const LINKS = 52;
const RECHTS = 8;
const BOVEN = 24;
const ONDER = 28;
const STAAF = 16;
const TUSSEN = 2;
const RONDING = 4;

const maandKort = (datum: string) =>
  new Date(datum).toLocaleDateString('nl-NL', { month: 'short' }).replace('.', '');
export const maandLang = (datum: string) =>
  new Date(datum).toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' });

/** Staaf met afgeronde bovenkant en een rechte voet op de basislijn. */
function staafPad(x: number, breedte: number, basis: number, hoogte: number): string {
  if (hoogte <= 0) return '';
  const r = Math.min(RONDING, hoogte, breedte / 2);
  const top = basis - hoogte;
  return [
    `M${String(x)},${String(basis)}`,
    `V${String(top + r)}`,
    `Q${String(x)},${String(top)} ${String(x + r)},${String(top)}`,
    `H${String(x + breedte - r)}`,
    `Q${String(x + breedte)},${String(top)} ${String(x + breedte)},${String(top + r)}`,
    `V${String(basis)}`,
    'Z',
  ].join(' ');
}

function beschrijving(rijen: MaandRij[]): string {
  if (rijen.length === 0) return 'Geen gegevens.';
  const hoogste = rijen.reduce((a, b) => (b.gepland > a.gepland ? b : a));
  return `Per maand een omlijnde staaf voor inzetbaar en een gevulde staaf voor gepland, van ${maandLang(rijen[0]?.periode_van ?? '')} tot ${maandLang(rijen[rijen.length - 1]?.periode_van ?? '')}. Het meeste gepland: ${maandLang(hoogste.periode_van)}, ${formatUren(hoogste.gepland)} uur.`;
}

export function MaandGrafiek({ rijen }: { rijen: MaandRij[] }) {
  const basisId = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const arcering = `${basisId}-arcering`;
  const titelId = `${basisId}-titel`;
  const omschrijvingId = `${basisId}-omschrijving`;

  const { max, stappen } = asSchaal(Math.max(0, ...rijen.flatMap((r) => [r.inzetbaar, r.gepland])));
  const basis = HOOG - ONDER;
  const plotHoog = basis - BOVEN;
  const groep = (BREED - LINKS - RECHTS) / Math.max(rijen.length, 1);
  const breedte = Math.min(STAAF, (groep - TUSSEN - 8) / 2);
  const y = (waarde: number) => (waarde / max) * plotHoog;

  return (
    <figure className="grafiek">
      <figcaption>
        <ul className="grafiek-legenda">
          <li>
            <span className="grafiek-staal grafiek-staal-inzetbaar" aria-hidden="true" />
            Inzetbaar
          </li>
          <li>
            <span className="grafiek-staal grafiek-staal-gepland" aria-hidden="true" />
            Gepland
          </li>
          <li>
            <span className="grafiek-staal grafiek-staal-boven" aria-hidden="true" />
            Gepland, boven capaciteit
          </li>
        </ul>
      </figcaption>
      <svg
        viewBox={`0 0 ${String(BREED)} ${String(HOOG)}`}
        role="img"
        aria-labelledby={`${titelId} ${omschrijvingId}`}
        className="grafiek-svg"
      >
        <title id={titelId}>Inzetbaar en gepland per maand</title>
        <desc id={omschrijvingId}>{beschrijving(rijen)}</desc>
        <defs>
          <pattern
            id={arcering}
            width="6"
            height="6"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <rect width="6" height="6" className="grafiek-arcering-grond" />
            <rect width="3" height="6" className="grafiek-arcering-lijn" />
          </pattern>
        </defs>

        {stappen.map((s) => (
          <g key={s}>
            <line
              x1={LINKS}
              x2={BREED - RECHTS}
              y1={basis - y(s)}
              y2={basis - y(s)}
              className={s === 0 ? 'grafiek-basislijn' : 'grafiek-raster'}
            />
            <text x={LINKS - 8} y={basis - y(s) + 4} textAnchor="end" className="grafiek-as">
              {formatUren(s).replace(/,0$/, '')}
            </text>
          </g>
        ))}
        <text x={LINKS - 8} y={10} textAnchor="end" className="grafiek-as">
          uur
        </text>

        {rijen.map((r, i) => {
          const midden = LINKS + groep * i + groep / 2;
          const xInzetbaar = midden - breedte - TUSSEN / 2;
          const xGepland = midden + TUSSEN / 2;
          const boven = r.zone === 'boven_capaciteit';
          return (
            <g key={r.periode_van} className="grafiek-groep">
              <title>
                {`${maandLang(r.periode_van)}: inzetbaar ${formatUren(r.inzetbaar)} uur, gepland ${formatUren(r.gepland)} uur${r.belastingsgraad === null ? '' : ` (${formatPercentage(r.belastingsgraad)} · ${zoneLabel(r.zone)})`}`}
              </title>
              {/* Groter raakvlak dan de staven, voor de tooltip. */}
              <rect
                x={LINKS + groep * i}
                y={BOVEN}
                width={groep}
                height={plotHoog}
                className="grafiek-raakvlak"
              />
              <path
                d={staafPad(xInzetbaar, breedte, basis, y(r.inzetbaar))}
                className="grafiek-inzetbaar"
              />
              <path
                d={staafPad(xGepland, breedte, basis, y(r.gepland))}
                className={boven ? undefined : 'grafiek-gepland'}
                fill={boven ? `url(#${arcering})` : undefined}
              />
              <text x={midden} y={HOOG - 8} textAnchor="middle" className="grafiek-as">
                {maandKort(r.periode_van)}
              </text>
            </g>
          );
        })}
      </svg>
      <details className="grafiek-tabel">
        <summary>Als tabel tonen</summary>
        <TabelVak label="Inzetbaar en gepland per maand">
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
              {rijen.map((m) => (
                <tr key={m.periode_van}>
                  <th scope="row">{maandLang(m.periode_van)}</th>
                  <td className="numeriek">{formatUren(m.inzetbaar)}</td>
                  <td className="numeriek">{formatUren(m.gepland)}</td>
                  <td>
                    <ZoneWeergave zone={m.zone} graad={m.belastingsgraad} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TabelVak>
      </details>
    </figure>
  );
}
