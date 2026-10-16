import { formatPercentage } from '../lib/opmaak';
import { zoneLabel } from './logica';

/**
 * Signaalzone: altijd als woord, met een neutrale grijze balk (geen rood/oranje/groen,
 * SPEC §1 en §5). Boven capaciteit krijgt een arcering, zodat het ook zonder kleur
 * zichtbaar is.
 */
export function ZoneWeergave({ zone, graad }: { zone: string | null; graad: number | null }) {
  const label = zoneLabel(zone);
  const breedte = graad === null ? 0 : Math.min(Math.max(graad, 0), 1.25) / 1.25;
  return (
    <span className={`zone zone-${zone ?? 'geen'}`}>
      <span className="zone-balk" aria-hidden="true">
        <span className="zone-vulling" style={{ width: `${String(Math.round(breedte * 100))}%` }} />
      </span>
      <span className="zone-tekst">
        {graad === null ? label : `${formatPercentage(graad)} · ${label}`}
      </span>
    </span>
  );
}
