import { useId } from 'react';
import { formatUren } from '../lib/opmaak';
import { ZONENAAM, type Zonegrenzen } from './logica';

/** Voorbeeldbalk per zone, zoals in ZoneWeergave (grijs; boven capaciteit gearceerd). */
function Staal({ zone, breedte }: { zone: string; breedte: number }) {
  return (
    <span className={`zone zone-${zone}`} aria-hidden="true">
      <span className="zone-balk">
        <span className="zone-vulling" style={{ width: `${String(breedte)}%` }} />
      </span>
    </span>
  );
}

/**
 * Uitleg van de signaalzones met de grenzen uit de instellingen (SPEC §5). Altijd woord,
 * balk en arcering samen: de zone blijkt nooit alleen uit kleur.
 */
export function ZoneLegenda({ grenzen }: { grenzen: Zonegrenzen | null }) {
  const titelId = useId();
  const pct = (n: number) => `${formatUren(n).replace(/,0$/, '')}%`;
  return (
    <section className="zone-legenda" aria-labelledby={titelId}>
      <h3 id={titelId} className="verborgen">
        Uitleg van de zones
      </h3>
      <p className="gedempt zone-legenda-intro">
        Belasting = gepland ÷ inzetbaar. De zone helpt bij het verdelen van werk; het is geen
        oordeel.
      </p>
      <ul>
        <li>
          <Staal zone="ruimte" breedte={50} />
          <span>
            <strong>{ZONENAAM.ruimte}</strong>
            {grenzen ? ` — onder ${pct(grenzen.vol)}` : null}
          </span>
        </li>
        <li>
          <Staal zone="vol" breedte={75} />
          <span>
            <strong>{ZONENAAM.vol}</strong>
            {grenzen ? ` — ${pct(grenzen.vol)} tot en met ${pct(grenzen.boven)}` : null}
          </span>
        </li>
        <li>
          <Staal zone="boven_capaciteit" breedte={100} />
          <span>
            <strong>{ZONENAAM.boven_capaciteit}</strong>
            {grenzen ? ` — boven ${pct(grenzen.boven)}` : null}
          </span>
        </li>
      </ul>
    </section>
  );
}
