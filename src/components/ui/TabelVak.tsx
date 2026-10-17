import type { ReactNode } from 'react';

/**
 * Scrolvak rond een brede tabel zonder knoppen of links. Op een smal scherm of bij zoom
 * scrolt de tabel binnen dit vak; omdat het focus kan krijgen, kan dat ook met de pijltjes
 * (WCAG 2.1.1). De naam maakt het vak herkenbaar voor schermlezers.
 */
export function TabelVak({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="tabel-schuif" role="region" aria-label={label} tabIndex={0}>
      {children}
    </div>
  );
}
