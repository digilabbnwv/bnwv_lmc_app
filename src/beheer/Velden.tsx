import { useId } from 'react';
import type { Formulierwaarden } from './schema';
import type { Veld } from './types';

interface Props {
  veld: Veld;
  waarden: Formulierwaarden;
  fout: string | undefined;
  nieuw: boolean;
  onWijzig: (naam: string, waarde: string | boolean) => void;
  /** Krijgt de focus als het paneel opent. */
  autofocus?: boolean;
}

function isAlleenLezen(veld: Veld, waarden: Formulierwaarden, nieuw: boolean): boolean {
  return typeof veld.alleenLezen === 'function'
    ? veld.alleenLezen(waarden, nieuw)
    : (veld.alleenLezen ?? false);
}

/** Lijst van datums (komma-gescheiden ISO in de formulierwaarde). */
function Datumlijst({
  id,
  veldNaam,
  waarde,
  alleenLezen,
  beschrijving,
  onWijzig,
}: {
  id: string;
  veldNaam: string;
  waarde: string;
  alleenLezen: boolean;
  beschrijving: string | undefined;
  onWijzig: (w: string) => void;
}) {
  const datums = waarde === '' ? [] : waarde.split(',');
  const zet = (lijst: string[]) => {
    onWijzig(lijst.join(','));
  };
  return (
    <div
      className="datumlijst"
      role="group"
      tabIndex={-1}
      data-veld={veldNaam}
      aria-labelledby={`${id}-label`}
      aria-describedby={beschrijving}
    >
      {datums.map((d, i) => (
        <div key={`${String(i)}-${d}`} className="datumlijst-rij">
          <input
            type="date"
            aria-label={`Datum ${String(i + 1)}`}
            value={d}
            readOnly={alleenLezen}
            onChange={(e) => {
              zet(datums.map((x, j) => (j === i ? e.target.value : x)));
            }}
          />
          {alleenLezen ? null : (
            <button
              type="button"
              className="secundair"
              onClick={() => {
                zet(datums.filter((_, j) => j !== i));
              }}
            >
              Verwijderen
            </button>
          )}
        </div>
      ))}
      {alleenLezen ? null : (
        <button
          type="button"
          className="secundair"
          onClick={() => {
            zet([...datums, '']);
          }}
        >
          Datum toevoegen
        </button>
      )}
    </div>
  );
}

export function VeldInvoer({ veld, waarden, fout, nieuw, onWijzig, autofocus = false }: Props) {
  const id = useId();
  const foutId = `${id}-fout`;
  const hulpId = `${id}-hulp`;
  const alleenLezen = isAlleenLezen(veld, waarden, nieuw);
  const waarde = waarden[veld.naam];
  const beschrijving =
    [veld.hulp ? hulpId : null, fout ? foutId : null].filter(Boolean).join(' ') || undefined;
  const gemeenschappelijk = {
    id,
    'aria-invalid': fout ? true : undefined,
    'aria-describedby': beschrijving,
    'aria-required': veld.verplicht ? true : undefined,
    // Voor het foutoverzicht (springen naar het veld) en de focus bij openen.
    'data-veld': veld.naam,
    'data-autofocus': autofocus || undefined,
  } as const;

  let invoer;
  switch (veld.type) {
    case 'vinkje':
      invoer = (
        <input
          {...gemeenschappelijk}
          type="checkbox"
          checked={waarde === true}
          disabled={alleenLezen}
          onChange={(e) => {
            onWijzig(veld.naam, e.target.checked);
          }}
        />
      );
      break;
    case 'keuze':
      invoer = (
        <select
          {...gemeenschappelijk}
          value={typeof waarde === 'string' ? waarde : ''}
          disabled={alleenLezen}
          onChange={(e) => {
            onWijzig(veld.naam, e.target.value);
          }}
        >
          {veld.legeOptie !== undefined || !veld.verplicht ? (
            <option value="">{veld.legeOptie ?? '— kies —'}</option>
          ) : (
            <option value="" disabled>
              — kies —
            </option>
          )}
          {(veld.opties ?? []).map((o) => (
            <option key={o.waarde} value={o.waarde}>
              {o.label}
            </option>
          ))}
        </select>
      );
      break;
    case 'tekstvak':
      invoer = (
        <textarea
          {...gemeenschappelijk}
          rows={3}
          value={typeof waarde === 'string' ? waarde : ''}
          readOnly={alleenLezen}
          onChange={(e) => {
            onWijzig(veld.naam, e.target.value);
          }}
        />
      );
      break;
    case 'datumlijst':
      return (
        <div className="veld">
          <span id={`${id}-label`} className="veld-label">
            {veld.label}
          </span>
          <Datumlijst
            id={id}
            veldNaam={veld.naam}
            waarde={typeof waarde === 'string' ? waarde : ''}
            alleenLezen={alleenLezen}
            beschrijving={beschrijving}
            onWijzig={(w) => {
              onWijzig(veld.naam, w);
            }}
          />
          {veld.hulp ? (
            <span id={hulpId} className="toelichting">
              {veld.hulp}
            </span>
          ) : null}
          {fout ? (
            <span id={foutId} className="veld-fout">
              {fout}
            </span>
          ) : null}
        </div>
      );
    default:
      invoer = (
        <input
          {...gemeenschappelijk}
          type={veld.type === 'getal' ? 'text' : veld.type === 'datum' ? 'date' : 'text'}
          inputMode={veld.type === 'getal' ? 'decimal' : undefined}
          value={typeof waarde === 'string' ? waarde : ''}
          readOnly={alleenLezen}
          onChange={(e) => {
            onWijzig(veld.naam, e.target.value);
          }}
        />
      );
  }

  return (
    <div className={veld.type === 'vinkje' ? 'veld veld-vinkje' : 'veld'}>
      <label htmlFor={id} className="veld-label">
        {veld.label}
        {veld.verplicht ? <span aria-hidden="true"> *</span> : null}
      </label>
      {invoer}
      {veld.hulp ? (
        <span id={hulpId} className="toelichting">
          {veld.hulp}
        </span>
      ) : null}
      {fout ? (
        <span id={foutId} className="veld-fout">
          {fout}
        </span>
      ) : null}
    </div>
  );
}
