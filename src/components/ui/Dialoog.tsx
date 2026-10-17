import { useEffect, useId, useRef, type ReactNode } from 'react';
import { PictogramKnop } from './Knop';

interface DialoogProps {
  open: boolean;
  titel: string;
  /** Escape, de sluitknop of een annuleerknop; de ouder zet `open` op false. */
  opSluiten: () => void;
  children: ReactNode;
  /** Knoppen onderaan, bijvoorbeeld Annuleren en Opslaan. */
  acties?: ReactNode;
  /** Dialoog in het midden, of een zijpaneel rechts (bewerken in beheer). */
  soort?: 'dialoog' | 'zijpaneel';
}

/**
 * Modale dialoog op basis van het eigen <dialog>-element van de browser: die houdt de focus
 * vast, maakt de rest van de pagina inert en sluit met Escape. Bij openen krijgt het element
 * met `data-autofocus` de focus; bij sluiten gaat de focus terug naar waar hij vandaan kwam.
 * De inhoud wordt pas getoond als de dialoog open is, zodat formulieren steeds leeg beginnen.
 */
export function Dialoog({
  open,
  titel,
  opSluiten,
  children,
  acties,
  soort = 'dialoog',
}: DialoogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const terug = useRef<HTMLElement | null>(null);
  const titelId = useId();

  useEffect(() => {
    const dialoog = ref.current;
    if (!dialoog) return;
    if (open && !dialoog.open) {
      terug.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialoog.showModal();
      dialoog.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    } else if (!open && dialoog.open) {
      dialoog.close();
    }
  }, [open]);

  // Bij verdwijnen terwijl de dialoog open is: netjes sluiten.
  useEffect(() => {
    const dialoog = ref.current;
    return () => {
      if (dialoog?.open) dialoog.close();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      className={soort === 'zijpaneel' ? 'dialoog zijpaneel' : 'dialoog'}
      aria-labelledby={titelId}
      onCancel={(e) => {
        // Escape: de ouder beslist (open blijft de enige bron van waarheid).
        e.preventDefault();
        opSluiten();
      }}
      onClose={() => {
        terug.current?.focus();
        terug.current = null;
      }}
    >
      {open ? (
        <div className="dialoog-vlak">
          <div className="dialoog-kop">
            <h2 id={titelId}>{titel}</h2>
            <PictogramKnop pictogram="sluiten" label="Sluiten" onClick={opSluiten} />
          </div>
          <div className="dialoog-inhoud">{children}</div>
          {acties ? <div className="dialoog-acties">{acties}</div> : null}
        </div>
      ) : null}
    </dialog>
  );
}
