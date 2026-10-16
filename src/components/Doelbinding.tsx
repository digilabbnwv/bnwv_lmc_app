// Vaste doelbindingstekst (SPEC §1). Altijd zichtbaar in de footer.
export const DOELBINDING_TEKST =
  'Dit overzicht is bedoeld voor capaciteitsplanning en een eerlijke werkverdeling. Het is geen middel om prestaties te beoordelen.';

export function Doelbinding() {
  return <p className="doelbinding">{DOELBINDING_TEKST}</p>;
}
