// Logica van het importscherm, los van React zodat hij goed te testen is.

export const MAX_BYTES = 10 * 1024 * 1024;

/** Controle in de browser vóór het versturen; de Edge Function controleert opnieuw. */
export function controleerBestand(bestand: { name: string; size: number } | null): string | null {
  if (!bestand) return 'Kies een MATT-export (XML).';
  if (!/\.xml$/i.test(bestand.name)) return 'Kies een XML-bestand (de export uit MATT).';
  if (bestand.size === 0) return 'Het bestand is leeg.';
  if (bestand.size > MAX_BYTES) return 'Het bestand is groter dan 10 MB.';
  return null;
}

export function controleerPeriode(van: string, tot: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(van) || !/^\d{4}-\d{2}-\d{2}$/.test(tot)) {
    return 'Vul de periode in waarover de export gaat.';
  }
  if (tot < van) return 'De einddatum ligt voor de begindatum.';
  return null;
}

export interface Voorvertoning {
  import_id: string;
  bestand: { regels: number; projecten: number; eindtotaal: { uren: number } };
  totaal: { aantal: number; uren: number };
  opgeslagen: { aantal: number; uren: number };
  medewerkers: { medewerker_id: string; aantal: number; uren: number }[];
  niet_gematcht: { naam: string; aantal: number; uren: number }[];
  niet_gematcht_aantal: number;
  niet_gekoppelde_projecten: { projectnummer: string; naam: string | null; uren: number }[];
  onbekende_artikelcodes: { artikelcode: string; aantal: number }[];
}

/** Zinnen die bovenaan de voorvertoning staan (neutraal, zonder beoordeling). */
export function samenvatting(v: Voorvertoning): string[] {
  const zinnen = [
    `Het bestand bevat ${String(v.bestand.regels)} boekingen in ${String(v.bestand.projecten)} projecten.`,
    `${String(v.opgeslagen.aantal)} boekingen zijn gekoppeld aan ${String(v.medewerkers.length)} medewerkers.`,
  ];
  if (v.niet_gematcht_aantal > 0) {
    zinnen.push(
      `${String(v.niet_gematcht_aantal)} boekingen horen bij een naam zonder alias en worden niet opgeslagen.`,
    );
  }
  if (v.niet_gekoppelde_projecten.length > 0) {
    zinnen.push(
      `${String(v.niet_gekoppelde_projecten.length)} MATT-projecten zijn nog niet aan een werkpakket gekoppeld.`,
    );
  }
  if (v.onbekende_artikelcodes.length > 0) {
    zinnen.push('Er zijn artikelcodes zonder categorie; vul de MATT-artikelcodes aan.');
  }
  return zinnen;
}
