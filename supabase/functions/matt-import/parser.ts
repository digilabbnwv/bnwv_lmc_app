// Controle en parser voor de MATT-export (SPEC §8): een SQL Server Reporting Services-
// export in XML. Het bestand wordt alleen in het geheugen verwerkt en nergens opgeslagen.
import { XMLParser } from 'npm:fast-xml-parser@5.11.1';

export const NAMESPACE = 'Project_x0020_uren_x0020_per_x0020_projectmanager_x0020_status';
export const MAX_BYTES = 10 * 1024 * 1024;
export const TOLERANTIE = 0.001;

/** Fout met een HTTP-status en een melding die de gebruiker kan begrijpen. */
export class ImportFout extends Error {
  constructor(public readonly status: number, melding: string) {
    super(melding);
  }
}

export interface Regel {
  medewerker: string;
  projectnummer: string;
  projectnaam: string;
  artikelcode: string;
  datum: string;
  uren: number;
  uren_open: number;
  verwerkt: number;
  nacalc: number;
  omschrijving: string;
}

export interface Totalen {
  uren_open: number;
  verwerkt: number;
  uren: number;
  nacalc: number;
}

export interface Resultaat {
  regels: Regel[];
  eindtotaal: Totalen;
  projecten: number;
}

/** Verwijdert een UTF-8 BOM. */
export function zonderBom(tekst: string): string {
  return tekst.charCodeAt(0) === 0xfeff ? tekst.slice(1) : tekst;
}

/**
 * Controles vóór het parsen (SPEC §8, stap 1): grootte, geen DOCTYPE/ENTITY
 * (bescherming tegen XXE en entity expansion), root-element en namespace.
 */
export function controleerVoorParsen(tekst: string): void {
  if (new TextEncoder().encode(tekst).length > MAX_BYTES) {
    throw new ImportFout(413, 'Het bestand is groter dan 10 MB.');
  }
  if (/<!DOCTYPE/i.test(tekst) || /<!ENTITY/i.test(tekst)) {
    throw new ImportFout(400, 'Het bestand bevat een DOCTYPE of ENTITY en wordt geweigerd.');
  }
  const start = /^\s*(?:<\?xml[^>]*\?>)?\s*<([A-Za-z_][\w.-]*)(\s[^>]*)?>/.exec(zonderBom(tekst));
  if (!start || start[1] !== 'Report') {
    throw new ImportFout(400, 'Dit is geen MATT-export: het root-element is niet "Report".');
  }
  const ns = /\sxmlns\s*=\s*"([^"]*)"/.exec(start[2] ?? '');
  if (!ns || ns[1] !== NAMESPACE) {
    throw new ImportFout(400, 'Dit is geen MATT-export: de namespace klopt niet.');
  }
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseAttributeValue: false,
  parseTagValue: false,
  processEntities: false,
  ignoreDeclaration: true,
  ignorePiTags: true,
  removeNSPrefix: true,
  trimValues: false,
  isArray: (naam: string) => ['project', 'artikel', 'Details'].includes(naam),
});

type Knoop = Record<string, unknown>;

function knoop(waarde: unknown, pad: string): Knoop {
  if (waarde === null || typeof waarde !== 'object' || Array.isArray(waarde)) {
    throw new ImportFout(400, `Onverwachte opbouw van het bestand bij ${pad}.`);
  }
  return waarde as Knoop;
}

function lijst(waarde: unknown): Knoop[] {
  if (waarde === undefined || waarde === '') return [];
  if (!Array.isArray(waarde)) throw new ImportFout(400, 'Onverwachte opbouw van het bestand.');
  return waarde as Knoop[];
}

function tekst(k: Knoop, attribuut: string, pad: string): string {
  const w = k[`@_${attribuut}`];
  if (typeof w !== 'string') {
    throw new ImportFout(400, `Ontbrekend attribuut ${attribuut} bij ${pad}.`);
  }
  return w;
}

/** Getal met een punt als decimaalteken (SPEC §8). */
function getal(k: Knoop, attribuut: string, pad: string): number {
  const w = tekst(k, attribuut, pad).trim();
  if (!/^-?\d+(\.\d+)?$/.test(w)) {
    throw new ImportFout(400, `Ongeldig getal "${w}" in ${attribuut} bij ${pad}.`);
  }
  return Number(w);
}

function datum(k: Knoop, pad: string): string {
  const w = tekst(k, 'datum', pad).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(w)) throw new ImportFout(400, `Ongeldige datum bij ${pad}.`);
  return w;
}

function som(regels: Regel[]): Totalen {
  return regels.reduce(
    (t, r) => ({
      uren_open: t.uren_open + r.uren_open,
      verwerkt: t.verwerkt + r.verwerkt,
      uren: t.uren + r.uren,
      nacalc: t.nacalc + r.nacalc,
    }),
    { uren_open: 0, verwerkt: 0, uren: 0, nacalc: 0 },
  );
}

const fmt = (n: number) => (Math.round(n * 1000) / 1000).toLocaleString('nl-NL');

function vergelijk(berekend: Totalen, verwacht: Totalen, waar: string): void {
  for (const veld of ['uren_open', 'verwerkt', 'uren', 'nacalc'] as const) {
    if (Math.abs(berekend[veld] - verwacht[veld]) > TOLERANTIE) {
      throw new ImportFout(
        400,
        `${waar}: de som van ${veld} (${fmt(berekend[veld])}) wijkt af van het subtotaal (${
          fmt(verwacht[veld])
        }). De import is gestopt.`,
      );
    }
  }
}

/**
 * Parseert de export en controleert per artikel, per project en voor het eindtotaal
 * of de subtotalen gelijk zijn aan de som van de boekingen (SPEC §8, stap 2).
 * Foutmeldingen noemen projectnummers en artikelcodes, nooit namen van personen.
 */
export function parseMatt(xml: string): Resultaat {
  controleerVoorParsen(xml);
  let document: Knoop;
  try {
    document = knoop(parser.parse(zonderBom(xml)), 'document');
  } catch (e) {
    if (e instanceof ImportFout) throw e;
    throw new ImportFout(400, 'Het bestand is geen geldige XML.');
  }

  const report = knoop(document.Report, 'Report');
  const tablix = knoop(report.Tablix1, 'Tablix1');
  const collectie = tablix.project_Collection === undefined
    ? {}
    : knoop(tablix.project_Collection, 'project_Collection');

  const regels: Regel[] = [];
  const projecten = lijst(collectie.project);
  for (const project of projecten) {
    const nummer = tekst(project, 'project', 'project').trim();
    const waarProject = `Project ${nummer}`;
    if (!/^\S{1,50}$/.test(nummer)) {
      throw new ImportFout(400, `Ongeldig projectnummer bij ${waarProject}.`);
    }
    const oms = knoop(project.Projectoms, waarProject);
    const projectnaam = tekst(oms, 'Projectoms', waarProject);
    const projectRegels: Regel[] = [];

    const artikelen = oms.artikel_Collection === undefined
      ? []
      : lijst(knoop(oms.artikel_Collection, waarProject).artikel);
    for (const artikel of artikelen) {
      const code = tekst(artikel, 'artikel', waarProject).trim();
      const waarArtikel = `${waarProject}, artikel ${code}`;
      const artikeloms = knoop(artikel.artikeloms, waarArtikel);
      const details = artikeloms.Details_Collection === undefined
        ? []
        : lijst(knoop(artikeloms.Details_Collection, waarArtikel).Details);

      const artikelRegels = details.map((d, i): Regel => {
        const waar = `${waarArtikel}, regel ${i + 1}`;
        const r: Regel = {
          medewerker: tekst(d, 'medewerker', waar),
          projectnummer: nummer,
          projectnaam,
          artikelcode: code,
          datum: datum(d, waar),
          uren: getal(d, 'uren', waar),
          uren_open: getal(d, 'uren_open', waar),
          verwerkt: getal(d, 'Textbox4', waar),
          nacalc: getal(d, 'nacalc', waar),
          omschrijving: typeof d['@_omschrijving'] === 'string' ? d['@_omschrijving'] : '',
        };
        if (Math.abs(r.uren - (r.verwerkt + r.uren_open)) > TOLERANTIE) {
          throw new ImportFout(400, `${waar}: uren is niet gelijk aan verwerkt + open.`);
        }
        return r;
      });

      vergelijk(som(artikelRegels), {
        uren_open: getal(artikeloms, 'Textbox22', waarArtikel),
        verwerkt: getal(artikeloms, 'Textbox6', waarArtikel),
        uren: getal(artikeloms, 'Textbox33', waarArtikel),
        nacalc: getal(artikeloms, 'Textbox34', waarArtikel),
      }, waarArtikel);
      projectRegels.push(...artikelRegels);
    }

    const sub = knoop(knoop(oms.Textbox23, waarProject).Textbox43, waarProject);
    vergelijk(som(projectRegels), {
      uren_open: getal(sub, 'Textbox29', waarProject),
      verwerkt: getal(sub, 'Textbox8', waarProject),
      uren: getal(sub, 'Textbox27', waarProject),
      nacalc: getal(sub, 'Textbox28', waarProject),
    }, waarProject);
    regels.push(...projectRegels);
  }

  const eind = knoop(
    knoop(
      knoop(knoop(tablix.Textbox15, 'eindtotaal').Textbox39, 'eindtotaal').Textbox16,
      'eindtotaal',
    )
      .Textbox44,
    'eindtotaal',
  );
  const eindtotaal = {
    uren_open: getal(eind, 'Textbox35', 'eindtotaal'),
    verwerkt: getal(eind, 'Textbox10', 'eindtotaal'),
    uren: getal(eind, 'Textbox20', 'eindtotaal'),
    nacalc: getal(eind, 'Textbox21', 'eindtotaal'),
  };
  vergelijk(som(regels), eindtotaal, 'Eindtotaal');

  return { regels, eindtotaal, projecten: projecten.length };
}

/** Alle boekingen moeten binnen de opgegeven periode vallen (SPEC §8, stap 3). */
export function controleerPeriode(regels: Regel[], van: string, tot: string): void {
  const buiten = regels.filter((r) => r.datum < van || r.datum > tot);
  if (buiten.length > 0) {
    const datums = [...new Set(buiten.map((r) => r.datum))].sort().slice(0, 5);
    throw new ImportFout(
      400,
      `${buiten.length} boeking(en) vallen buiten de periode, bijvoorbeeld op ${
        datums.join(', ')
      }. Pas de periode aan of exporteer opnieuw.`,
    );
  }
}
