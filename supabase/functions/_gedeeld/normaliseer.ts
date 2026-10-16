// Gedeelde hulpfuncties voor Edge Functions.

/**
 * Normaliseert een naam voor het matchen van aliassen (SPEC §4):
 * trim, meerdere spaties samenvoegen, kleine letters.
 * MATT vult `medewerker` op met spaties tot 64 tekens.
 */
export function normaliseerNaam(naam: string): string {
  return naam.trim().replace(/\s+/g, ' ').toLowerCase();
}
