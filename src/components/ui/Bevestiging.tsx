import { createContext, use, useCallback, useState, type ReactNode } from 'react';
import { Dialoog } from './Dialoog';
import { Knop } from './Knop';

export interface BevestigVraag {
  titel: string;
  /** Wat er precies gebeurt, bijvoorbeeld wat er verdwijnt. */
  tekst: ReactNode;
  /** Tekst op de bevestigknop, bijvoorbeeld "Verwijderen". */
  bevestigTekst?: string;
}

type Bevestig = (vraag: BevestigVraag) => Promise<boolean>;

const BevestigContext = createContext<Bevestig | null>(null);

interface Open extends BevestigVraag {
  klaar: (antwoord: boolean) => void;
}

/**
 * Vervangt window.confirm door een eigen, toegankelijke dialoog. De focus start op
 * "Annuleren", zodat een onbedoelde Enter niets verwijdert.
 */
export function BevestigingProvider({ children }: { children: ReactNode }) {
  const [vraag, setVraag] = useState<Open | null>(null);

  const bevestig = useCallback<Bevestig>(
    (v) =>
      new Promise<boolean>((klaar) => {
        setVraag({ ...v, klaar });
      }),
    [],
  );

  function antwoord(ja: boolean) {
    vraag?.klaar(ja);
    setVraag(null);
  }

  return (
    <BevestigContext value={bevestig}>
      {children}
      <Dialoog
        open={vraag !== null}
        titel={vraag?.titel ?? ''}
        opSluiten={() => {
          antwoord(false);
        }}
        acties={
          <>
            <Knop
              variant="secundair"
              data-autofocus
              onClick={() => {
                antwoord(false);
              }}
            >
              Annuleren
            </Knop>
            <Knop
              onClick={() => {
                antwoord(true);
              }}
            >
              {vraag?.bevestigTekst ?? 'Bevestigen'}
            </Knop>
          </>
        }
      >
        <p>{vraag?.tekst}</p>
      </Dialoog>
    </BevestigContext>
  );
}

/** Geeft `bevestig(vraag)` terug: een belofte met true (bevestigd) of false. */
export function useBevestig(): Bevestig {
  const bevestig = use(BevestigContext);
  if (!bevestig) throw new Error('useBevestig buiten BevestigingProvider');
  return bevestig;
}
