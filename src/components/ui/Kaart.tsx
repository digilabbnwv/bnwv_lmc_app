import { useId, type ReactNode } from 'react';

interface KaartProps {
  titel?: string;
  /** Kopniveau binnen de pagina; standaard h3. */
  niveau?: 2 | 3 | 4;
  children: ReactNode;
}

/** Een afgebakend blok inhoud. Met titel wordt het een benoemde sectie. */
export function Kaart({ titel, niveau = 3, children }: KaartProps) {
  const id = useId();
  if (!titel) return <div className="kaart">{children}</div>;
  const Kop = `h${String(niveau)}` as 'h2' | 'h3' | 'h4';
  return (
    <section className="kaart" aria-labelledby={id}>
      <Kop id={id} className="kaart-titel">
        {titel}
      </Kop>
      {children}
    </section>
  );
}

interface LegeStaatProps {
  titel: string;
  children?: ReactNode;
  /** Bijvoorbeeld een knop "Toevoegen". */
  actie?: ReactNode;
}

/** Wat je ziet als er (nog) niets is, met uitleg wat je kunt doen. */
export function LegeStaat({ titel, children, actie }: LegeStaatProps) {
  return (
    <div className="lege-staat">
      <p className="lege-staat-titel">{titel}</p>
      {children ? <p>{children}</p> : null}
      {actie ?? null}
    </div>
  );
}

/** Neutraal label, bijvoorbeeld een rol of een status. */
export function Badge({ children, nadruk = false }: { children: ReactNode; nadruk?: boolean }) {
  return <span className={nadruk ? 'badge badge-nadruk' : 'badge'}>{children}</span>;
}
