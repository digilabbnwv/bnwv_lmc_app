import { assertEquals } from '@std/assert';
import { normaliseerNaam } from './normaliseer.ts';

Deno.test('normaliseerNaam verwijdert opvulspaties uit MATT', () => {
  assertEquals(normaliseerNaam('Sanne de Vries' + ' '.repeat(50)), 'sanne de vries');
});

Deno.test('normaliseerNaam voegt meerdere spaties samen en maakt kleine letters', () => {
  assertEquals(normaliseerNaam('  Lotte   Visser -  de Boer '), 'lotte visser - de boer');
});
