import { assert, assertEquals } from '@std/assert';
import { type AanmaakPoort, domeinVan, type Medewerker, verwerk } from './handler.ts';

const ORIGINS = new Set(['https://app.voorbeeld.test']);
const MW = '11111111-1111-4111-8111-111111111111';

interface Stand {
  magBeheren: boolean;
  medewerker: Medewerker | null;
  heeftAccount: boolean;
  domein: string | null;
  koppeling: 'ok' | 'geweigerd' | 'fout';
  aangemaakt: string[];
  verwijderd: string[];
  gekoppeld: { gebruikerId: string; rollen: string[] }[];
}

function stand(over: Partial<Stand> = {}): Stand {
  return {
    magBeheren: true,
    medewerker: { id: MW, email: 'lotte.visser@voorbeeld.test', actief: true },
    heeftAccount: false,
    domein: 'voorbeeld.test',
    koppeling: 'ok',
    aangemaakt: [],
    verwijderd: [],
    gekoppeld: [],
    ...over,
  };
}

function poort(s: Stand): AanmaakPoort {
  return {
    magBeheren: () => Promise.resolve(s.magBeheren),
    zoekMedewerker: () => Promise.resolve(s.medewerker),
    heeftAccount: () => Promise.resolve(s.heeftAccount),
    toegestaanDomein: () => Promise.resolve(s.domein),
    maakAuthGebruiker: (email) => {
      s.aangemaakt.push(email);
      return Promise.resolve('22222222-2222-4222-8222-222222222222');
    },
    koppel: (gebruikerId, _mw, rollen) => {
      if (s.koppeling === 'fout') return Promise.reject(new Error('netwerk'));
      if (s.koppeling === 'ok') s.gekoppeld.push({ gebruikerId, rollen });
      return Promise.resolve(s.koppeling);
    },
    verwijderAuthGebruiker: (id) => {
      s.verwijderd.push(id);
      return Promise.resolve();
    },
  };
}

function verzoek(body: unknown, token: string | null = 'jwt', methode = 'POST'): Request {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Origin: 'https://app.voorbeeld.test',
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return new Request('http://localhost/gebruiker-aanmaken', {
    method: methode,
    headers,
    body: methode === 'POST' ? JSON.stringify(body) : undefined,
  });
}

const geldig = { medewerker_id: MW, rollen: ['lmc'] };

async function antwoord(s: Stand, req = verzoek(geldig)) {
  const res = await verwerk(req, ORIGINS, () => poort(s));
  return { status: res.status, body: await res.json().catch(() => null), res };
}

Deno.test('zonder token: 401 en geen account', async () => {
  const s = stand();
  const { status } = await antwoord(s, verzoek(geldig, null));
  assertEquals(status, 401);
  assertEquals(s.aangemaakt, []);
});

Deno.test('zonder recht (lmc, coordinator of aal1): 403 en geen account', async () => {
  const s = stand({ magBeheren: false });
  const { status } = await antwoord(s);
  assertEquals(status, 403);
  assertEquals(s.aangemaakt, []);
});

Deno.test('ongeldige invoer: 400', async () => {
  for (
    const body of [
      {},
      { medewerker_id: 'geen-uuid', rollen: ['lmc'] },
      { medewerker_id: MW, rollen: [] },
      { medewerker_id: MW, rollen: ['superuser'] },
      { medewerker_id: MW, rollen: ['lmc', 'lmc'] },
    ]
  ) {
    const s = stand();
    assertEquals((await antwoord(s, verzoek(body))).status, 400, JSON.stringify(body));
    assertEquals(s.aangemaakt, []);
  }
});

Deno.test('onbekende of inactieve medewerker: 404 / 400', async () => {
  assertEquals((await antwoord(stand({ medewerker: null }))).status, 404);
  const inactief = stand({ medewerker: { id: MW, email: 'a@voorbeeld.test', actief: false } });
  assertEquals((await antwoord(inactief)).status, 400);
  assertEquals(inactief.aangemaakt, []);
});

Deno.test('medewerker heeft al een account: 409', async () => {
  const s = stand({ heeftAccount: true });
  assertEquals((await antwoord(s)).status, 409);
  assertEquals(s.aangemaakt, []);
});

Deno.test('e-mailadres buiten het toegestane domein: 400', async () => {
  const s = stand({ medewerker: { id: MW, email: 'iemand@ander.nl', actief: true } });
  assertEquals((await antwoord(s)).status, 400);
  assertEquals(s.aangemaakt, []);
  const subdomein = stand({
    medewerker: { id: MW, email: 'x@kwaad.voorbeeld.test', actief: true },
  });
  assertEquals((await antwoord(subdomein)).status, 400);
  const geenDomein = stand({ domein: null });
  assertEquals((await antwoord(geenDomein)).status, 400);
});

Deno.test('geslaagd: 201, wachtwoord één keer, no-store, e-mail van de medewerker', async () => {
  const s = stand();
  const { status, body, res } = await antwoord(s);
  assertEquals(status, 201);
  assertEquals(typeof body.tijdelijk_wachtwoord, 'string');
  assertEquals(body.tijdelijk_wachtwoord.length, 20);
  assertEquals(res.headers.get('Cache-Control'), 'no-store');
  assertEquals(res.headers.get('Access-Control-Allow-Origin'), 'https://app.voorbeeld.test');
  assertEquals(s.aangemaakt, ['lotte.visser@voorbeeld.test']);
  assertEquals(s.gekoppeld[0]?.rollen, ['lmc']);
});

Deno.test('rol niet toegestaan (RLS weigert): 403 en het account wordt teruggedraaid', async () => {
  const s = stand({ koppeling: 'geweigerd' });
  assertEquals((await antwoord(s)).status, 403);
  assertEquals(s.verwijderd, ['22222222-2222-4222-8222-222222222222']);
});

Deno.test('koppelen mislukt: 500 en het account wordt teruggedraaid', async () => {
  const s = stand({ koppeling: 'fout' });
  const { status, body } = await antwoord(s);
  assertEquals(status, 500);
  assert(!('tijdelijk_wachtwoord' in body));
  assertEquals(s.verwijderd, ['22222222-2222-4222-8222-222222222222']);
});

Deno.test('alleen POST; preflight alleen voor toegestane origins', async () => {
  assertEquals((await antwoord(stand(), verzoek(null, 'jwt', 'GET'))).status, 405);
  const pre = await verwerk(
    new Request('http://localhost/x', {
      method: 'OPTIONS',
      headers: { Origin: 'https://kwaad.nl' },
    }),
    ORIGINS,
    () => poort(stand()),
  );
  assertEquals(pre.status, 204);
  assertEquals(pre.headers.get('Access-Control-Allow-Origin'), null);
});

Deno.test('domeinVan', () => {
  assertEquals(domeinVan('A.B@Voorbeeld.Test'), 'voorbeeld.test');
});
