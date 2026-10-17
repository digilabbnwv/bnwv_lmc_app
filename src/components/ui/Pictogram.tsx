// Kleine set eigen lijnpictogrammen (inline SVG, geen externe bron). Altijd decoratief:
// de betekenis staat ook in tekst.

const PADEN = {
  menu: 'M4 7h16M4 12h16M4 17h16',
  sluiten: 'M6 6l12 12M18 6L6 18',
  info: 'M12 11v6M12 7.5v.01M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
  'let-op': 'M12 8v5M12 16.5v.01M12 3l9.5 17h-19L12 3z',
  fout: 'M12 7v6M12 16.5v.01M8.2 3h7.6L21 8.2v7.6L15.8 21H8.2L3 15.8V8.2L8.2 3z',
  gelukt: 'M5 12.5l4.5 4.5L19 7.5',
} as const;

export type PictogramNaam = keyof typeof PADEN;

export function Pictogram({ naam }: { naam: PictogramNaam }) {
  return (
    <svg
      className="pictogram"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PADEN[naam]} />
    </svg>
  );
}
