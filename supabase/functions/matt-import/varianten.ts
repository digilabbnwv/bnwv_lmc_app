// Negatieve varianten van fixtures/matt-export-synthetisch.xml (SPEC §8: "genereer de
// negatieve varianten als aparte fixtures op basis van de geldige fixture").
// Opnieuw genereren (vanuit supabase/functions): deno task fixtures
// Een test controleert dat de gecommitte varianten gelijk zijn aan deze functies.
import { NAMESPACE } from './parser.ts';

function vervangEenmaal(tekst: string, zoek: string, door: string): string {
  const i = tekst.indexOf(zoek);
  if (i < 0) throw new Error(`Niet gevonden in de fixture: ${zoek}`);
  return tekst.slice(0, i) + door + tekst.slice(i + zoek.length);
}

/** Subtotaal "uren" van het eerste artikel (project 901, artikel 10) klopt niet meer. */
export function afwijkendSubtotaal(xml: string): string {
  return vervangEenmaal(xml, 'Textbox33="6"', 'Textbox33="6.5"');
}

/** Een DOCTYPE met ENTITY direct na de XML-declaratie. */
export function metDoctype(xml: string): string {
  return vervangEenmaal(xml, '?>', '?><!DOCTYPE Report [<!ENTITY test "test">]>');
}

/** Een andere default namespace op het root-element. */
export function verkeerdeNamespace(xml: string): string {
  return vervangEenmaal(xml, `xmlns="${NAMESPACE}"`, 'xmlns="Een_ander_rapport"');
}

export const VARIANTEN = {
  'afwijkend-subtotaal.xml': afwijkendSubtotaal,
  'met-doctype.xml': metDoctype,
  'verkeerde-namespace.xml': verkeerdeNamespace,
} as const;

if (import.meta.main) {
  const map = new URL('../../../fixtures/', import.meta.url);
  const bron = await Deno.readTextFile(new URL('matt-export-synthetisch.xml', map));
  await Deno.mkdir(new URL('matt-varianten/', map), { recursive: true });
  for (const [naam, maak] of Object.entries(VARIANTEN)) {
    await Deno.writeTextFile(new URL(`matt-varianten/${naam}`, map), maak(bron));
    console.log(`geschreven: fixtures/matt-varianten/${naam}`);
  }
}
