import { assert, assertEquals, assertNotEquals } from '@std/assert';
import { ALFABET, genereerWachtwoord, LENGTE } from './wachtwoord.ts';

Deno.test('genereerWachtwoord: lengte 20 en alleen tekens uit het alfabet', () => {
  for (let i = 0; i < 200; i++) {
    const w = genereerWachtwoord();
    assertEquals(w.length, LENGTE);
    for (const teken of w) assert(ALFABET.includes(teken), `onverwacht teken ${teken}`);
  }
});

Deno.test('genereerWachtwoord: geen verwarrende tekens', () => {
  for (const teken of '0O1lI') assert(!ALFABET.includes(teken));
});

Deno.test('genereerWachtwoord: minstens 100 bits entropie', () => {
  assert(LENGTE * Math.log2(ALFABET.length) >= 100);
});

Deno.test('genereerWachtwoord: geeft steeds een ander wachtwoord', () => {
  const gezien = new Set(Array.from({ length: 500 }, () => genereerWachtwoord()));
  assertEquals(gezien.size, 500);
  assertNotEquals(genereerWachtwoord(), genereerWachtwoord());
});

Deno.test('genereerWachtwoord: alle tekens komen ongeveer even vaak voor', () => {
  const telling = new Map<string, number>();
  const n = 4000;
  for (let i = 0; i < n; i++) {
    for (const t of genereerWachtwoord()) telling.set(t, (telling.get(t) ?? 0) + 1);
  }
  const verwacht = (n * LENGTE) / ALFABET.length;
  for (const teken of ALFABET) {
    const aantal = telling.get(teken) ?? 0;
    assert(Math.abs(aantal - verwacht) < verwacht * 0.2, `${teken}: ${aantal} (≈${verwacht})`);
  }
});
