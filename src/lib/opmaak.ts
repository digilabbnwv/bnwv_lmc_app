// Weergave van getallen en datums (SPEC §5: afronden pas in de weergave, 1 decimaal).

const urenFormaat = new Intl.NumberFormat('nl-NL', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** Uren met één decimaal in Nederlandse notatie, bijv. 904,4. Leeg bij null. */
export function formatUren(waarde: number | null | undefined): string {
  if (waarde === null || waarde === undefined || Number.isNaN(waarde)) return '';
  return urenFormaat.format(waarde);
}

/** Percentage zonder decimalen, bijv. 87%. Leeg bij null. */
export function formatPercentage(fractie: number | null | undefined): string {
  if (fractie === null || fractie === undefined || Number.isNaN(fractie)) return '';
  return `${String(Math.round(fractie * 100))}%`;
}

/** ISO-datum (jjjj-mm-dd) als dd-mm-jjjj. */
export function formatDatum(iso: string | null | undefined): string {
  if (!iso) return '';
  const [jaar, maand, dag] = iso.slice(0, 10).split('-');
  if (!jaar || !maand || !dag) return iso;
  return `${dag}-${maand}-${jaar}`;
}
