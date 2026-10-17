import type { ReactNode } from 'react';

interface KerngetalProps {
  label: string;
  waarde: string;
  eenheid?: string;
  /** Uitleg achter "Hoe wordt dit berekend?" (een <details>, werkt met toetsenbord). */
  uitleg?: ReactNode;
}

/** Eén kerngetal; plaats ze in <Kerngetallen>, een definitielijst. */
export function Kerngetal({ label, waarde, eenheid, uitleg }: KerngetalProps) {
  return (
    <div className="kerngetal">
      <dt>{label}</dt>
      <dd>
        <span className="kerngetal-waarde">{waarde}</span>
        {eenheid ? <span className="kerngetal-eenheid"> {eenheid}</span> : null}
        {uitleg ? (
          <details className="kerngetal-uitleg">
            <summary>Hoe wordt dit berekend?</summary>
            <p>{uitleg}</p>
          </details>
        ) : null}
      </dd>
    </div>
  );
}

export function Kerngetallen({ children }: { children: ReactNode }) {
  return <dl className="kerngetallen">{children}</dl>;
}
