import { assert, assertEquals } from '@std/assert';
import { type ImportPoort, verwerk } from './handler.ts';
import type { Regel } from './parser.ts';

const map = new URL('../../../fixtures/', import.meta.url);
const geldig = await Deno.readTextFile(new URL('matt-export-synthetisch.xml', map));
const ORIGINS = new Set(['https://app.voorbeeld.test']);

interface Stand {
  magImporteren: boolean;
  opgeslagen: { van: string; tot: string; regels: Regel[] }[];
}

function poort(s: Stand): ImportPoort {
  return {
    magImporteren: () => Promise.resolve(s.magImporteren),
    conceptOpslaan: (van, tot, regels) => {
      s.opgeslagen.push({ van, tot, regels });
      return Promise.resolve({ import_id: 'abc', opgeslagen: { aantal: regels.length - 1 } });
    },
    nietGematcht: () => Promise.resolve([{ naam: 'Testpersoon Onbekend', aantal: 1, uren: 2 }]),
  };
}

function verzoek(
  xml: string,
  periode: [string | null, string | null] = ['2026-01-01', '2026-03-31'],
  token: string | null = 'jwt',
): Request {
  const headers: Record<string, string> = {
    'Content-Type': 'application/xml',
    Origin: 'https://app.voorbeeld.test',
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (periode[0]) headers['X-Periode-Van'] = periode[0];
  if (periode[1]) headers['X-Periode-Tot'] = periode[1];
  return new Request('http://localhost/matt-import', { method: 'POST', headers, body: xml });
}

async function antwoord(s: Stand, req: Request) {
  const res = await verwerk(req, ORIGINS, () => poort(s));
  return { status: res.status, body: await res.json(), res };
}

const nieuw = (over: Partial<Stand> = {}): Stand => ({
  magImporteren: true,
  opgeslagen: [],
  ...over,
});

Deno.test('zonder token: 401; zonder recht (lmc of aal1): 403, niets opgeslagen', async () => {
  const s = nieuw({ magImporteren: false });
  assertEquals((await antwoord(s, verzoek(geldig, undefined, null))).status, 401);
  assertEquals((await antwoord(s, verzoek(geldig))).status, 403);
  assertEquals(s.opgeslagen, []);
});

Deno.test('geldige fixture: concept opgeslagen, voorvertoning met bestandstotalen', async () => {
  const s = nieuw();
  const { status, body, res } = await antwoord(s, verzoek(geldig));
  assertEquals(status, 200);
  assertEquals(s.opgeslagen.length, 1);
  assertEquals(s.opgeslagen[0]!.regels.length, 79);
  assertEquals(body.import_id, 'abc');
  assertEquals(body.bestand.eindtotaal.uren, 171.75);
  assertEquals(body.niet_gematcht[0].naam, 'Testpersoon Onbekend');
  assertEquals(res.headers.get('Cache-Control'), 'no-store');
});

Deno.test('periode ontbreekt of is ongeldig: 400', async () => {
  for (
    const p of [[null, '2026-03-31'], ['2026-03-31', '2026-01-01'], [
      '1-1-2026',
      '2026-03-31',
    ]] as const
  ) {
    const s = nieuw();
    assertEquals((await antwoord(s, verzoek(geldig, [p[0], p[1]]))).status, 400, JSON.stringify(p));
    assertEquals(s.opgeslagen, []);
  }
});

Deno.test('boekingen buiten de periode: 400, niets opgeslagen', async () => {
  const s = nieuw();
  const { status, body } = await antwoord(s, verzoek(geldig, ['2026-02-01', '2026-03-31']));
  assertEquals(status, 400);
  assert(body.fout.includes('buiten de periode'));
  assertEquals(s.opgeslagen, []);
});

Deno.test('DOCTYPE in het bestand: 400, niets opgeslagen', async () => {
  const s = nieuw();
  const xml = geldig.replace('?>', '?><!DOCTYPE Report [<!ENTITY a "b">]>');
  assertEquals((await antwoord(s, verzoek(xml))).status, 400);
  assertEquals(s.opgeslagen, []);
});

Deno.test('Content-Length boven 10 MB: 413 zonder het bestand te lezen', async () => {
  const s = nieuw();
  const req = new Request('http://localhost/matt-import', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer jwt',
      'Content-Length': String(11 * 1024 * 1024),
      'X-Periode-Van': '2026-01-01',
      'X-Periode-Tot': '2026-03-31',
    },
    body: 'x',
  });
  assertEquals((await antwoord(s, req)).status, 413);
});

Deno.test('preflight staat de periode-headers toe', async () => {
  const res = await verwerk(
    new Request('http://localhost/matt-import', {
      method: 'OPTIONS',
      headers: { Origin: 'https://app.voorbeeld.test' },
    }),
    ORIGINS,
    () => poort(nieuw()),
  );
  assertEquals(res.status, 204);
  assert(res.headers.get('Access-Control-Allow-Headers')?.includes('x-periode-van'));
});
