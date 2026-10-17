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

export type Stap = 1 | 2 | 3;

/** Stap van de import: 1 bestand en periode, 2 controle, 3 verwerkt. */
export function huidigeStap(voorvertoning: Voorvertoning | null, afgerond: boolean): Stap {
  if (afgerond) return 3;
  return voorvertoning ? 2 : 1;
}

/** Vraagt de voorvertoning nog iets van de gebruiker vóór definitief maken? */
export function actieNodig(v: Voorvertoning): boolean {
  return v.niet_gematcht.length > 0 || v.onbekende_artikelcodes.length > 0;
}

const iso = (d: Date) =>
  `${String(d.getFullYear())}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** De hele vorige kalendermaand ten opzichte van `vandaag`. */
export function vorigeMaand(vandaag: Date): { van: string; tot: string } {
  const eerste = new Date(vandaag.getFullYear(), vandaag.getMonth() - 1, 1);
  const laatste = new Date(vandaag.getFullYear(), vandaag.getMonth(), 0);
  return { van: iso(eerste), tot: iso(laatste) };
}

/** Van het begin van het schooljaar tot en met gisteren (of het einde van het schooljaar). */
export function schooljaarTotGisteren(
  schooljaar: { startdatum: string; einddatum: string },
  vandaag: Date,
): { van: string; tot: string } | null {
  const gisteren = iso(new Date(vandaag.getFullYear(), vandaag.getMonth(), vandaag.getDate() - 1));
  const tot = gisteren < schooljaar.einddatum ? gisteren : schooljaar.einddatum;
  return tot < schooljaar.startdatum ? null : { van: schooljaar.startdatum, tot };
}

/** Bestandsgrootte voor mensen: "350 kB" of "1,2 MB". */
export function bestandsgrootte(bytes: number): string {
  if (bytes < 1024 * 1024) return `${String(Math.max(1, Math.round(bytes / 1024)))} kB`;
  return `${(bytes / (1024 * 1024)).toLocaleString('nl-NL', { maximumFractionDigits: 1 })} MB`;
}
