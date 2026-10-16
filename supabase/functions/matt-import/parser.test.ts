import { assert, assertEquals, assertStringIncludes, assertThrows } from '@std/assert';
import { controleerPeriode, ImportFout, MAX_BYTES, NAMESPACE, parseMatt } from './parser.ts';
import { VARIANTEN } from './varianten.ts';

const map = new URL('../../../fixtures/', import.meta.url);
const geldig = await Deno.readTextFile(new URL('matt-export-synthetisch.xml', map));
const variant = (naam: string) => Deno.readTextFile(new URL(`matt-varianten/${naam}`, map));

function verwachtFout(fn: () => unknown, status: number, tekst: string) {
  const e = assertThrows(fn, ImportFout);
  assertEquals(e.status, status);
  assertStringIncludes(e.message, tekst);
}

Deno.test('geldige synthetische fixture: alle regels, eindtotaal 171,75', () => {
  const r = parseMatt(geldig);
  assertEquals(r.projecten, 14);
  assertEquals(r.regels.length, 79);
  assertEquals(r.eindtotaal, { uren_open: 20.5, verwerkt: 151.25, uren: 171.75, nacalc: 0 });
  const som = r.regels.reduce((t, x) => t + x.uren, 0);
  assert(Math.abs(som - 171.75) < 0.001);
});

Deno.test('geldige fixture: begint met een BOM en is één regel', () => {
  assertEquals(geldig.charCodeAt(0), 0xfeff);
  assert(!geldig.includes('\n'));
});

Deno.test('geldige fixture: medewerker met opvulspaties, datum als jjjj-mm-dd', () => {
  const r = parseMatt(geldig);
  const eerste = r.regels[0]!;
  assertEquals(eerste.projectnummer, '901');
  assertEquals(eerste.artikelcode, '10');
  assertEquals(eerste.datum, '2026-01-18');
  assertEquals(eerste.medewerker.length, 64, 'MATT vult de naam op tot 64 tekens');
  assertEquals(eerste.medewerker.trim(), 'Pieter Jansen - Bakker');
});

Deno.test('geldige fixture: bevat de niet-gematchte "Testpersoon Onbekend" en project 999', () => {
  const r = parseMatt(geldig);
  assertEquals(r.regels.filter((x) => x.medewerker.trim() === 'Testpersoon Onbekend').length, 1);
  assert(r.regels.some((x) => x.projectnummer === '999'));
});

Deno.test('geldige fixture: uren = verwerkt + uren_open voor elke regel', () => {
  for (const x of parseMatt(geldig).regels) {
    assert(Math.abs(x.uren - (x.verwerkt + x.uren_open)) < 0.001);
  }
});

Deno.test('projectnamen zijn inconsistent; er wordt alleen op nummer gewerkt', () => {
  const namen = new Set(parseMatt(geldig).regels.map((x) => x.projectnaam));
  assert(namen.has('Zonnebloem-HAR') && namen.has('De Regenboog - ERM'));
});

Deno.test('afwijkend subtotaal: import stopt met project en artikel in de melding', async () => {
  const xml = await variant('afwijkend-subtotaal.xml');
  verwachtFout(() => parseMatt(xml), 400, 'Project 901, artikel 10');
});

Deno.test('DOCTYPE: geweigerd vóór het parsen', async () => {
  const xml = await variant('met-doctype.xml');
  verwachtFout(() => parseMatt(xml), 400, 'DOCTYPE');
});

Deno.test('ENTITY zonder DOCTYPE: ook geweigerd', () => {
  verwachtFout(() => parseMatt(geldig.replace('?>', '?><!ENTITY x "y">')), 400, 'ENTITY');
});

Deno.test('verkeerde namespace: geweigerd', async () => {
  const xml = await variant('verkeerde-namespace.xml');
  verwachtFout(() => parseMatt(xml), 400, 'namespace');
});

Deno.test('ander root-element: geweigerd', () => {
  verwachtFout(
    () => parseMatt(`<?xml version="1.0"?><Rapport xmlns="${NAMESPACE}"></Rapport>`),
    400,
    'root-element',
  );
});

Deno.test('te groot bestand (> 10 MB): geweigerd', () => {
  // Bewust in de test gemaakt: zo komt er geen bestand van 10 MB in de repository.
  const groot = geldig + ' '.repeat(MAX_BYTES);
  verwachtFout(() => parseMatt(groot), 413, '10 MB');
});

Deno.test('ongeldige XML: duidelijke melding', () => {
  verwachtFout(
    () => parseMatt(`<?xml version="1.0"?><Report xmlns="${NAMESPACE}"><Tablix1>`),
    400,
    '',
  );
});

Deno.test('getallen met een komma worden niet stil geaccepteerd', () => {
  verwachtFout(
    () => parseMatt(geldig.replace('Textbox4="5.5"', 'Textbox4="5,5"')),
    400,
    'Ongeldig getal',
  );
});

Deno.test('regel waarin uren ≠ verwerkt + open: geweigerd', () => {
  verwachtFout(
    () => parseMatt(geldig.replace('Textbox4="5.5" uren="5.5"', 'Textbox4="5" uren="5.5"')),
    400,
    'verwerkt + open',
  );
});

Deno.test('boeking buiten de periode: foutmelding zonder namen', () => {
  const { regels } = parseMatt(geldig);
  controleerPeriode(regels, '2026-01-01', '2026-03-31');
  const e = assertThrows(() => controleerPeriode(regels, '2026-02-01', '2026-03-31'), ImportFout);
  assertEquals(e.status, 400);
  assertStringIncludes(e.message, 'buiten de periode');
  assert(!e.message.includes('Jansen') && !e.message.includes('Testpersoon'));
});

Deno.test('de gecommitte varianten zijn gelijk aan de generator', async () => {
  for (const [naam, maak] of Object.entries(VARIANTEN)) {
    assertEquals(await variant(naam), maak(geldig), naam);
  }
});
