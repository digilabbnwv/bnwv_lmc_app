/** Laadindicator met tekst; de draaiende cirkel is alleen decoratie. */
export function Laden({ tekst = 'Bezig met laden…' }: { tekst?: string }) {
  return (
    <p className="laden" role="status" aria-busy="true">
      <span className="laden-draai" aria-hidden="true" />
      {tekst}
    </p>
  );
}
