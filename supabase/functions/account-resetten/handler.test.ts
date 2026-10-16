import { assert, assertEquals } from '@std/assert';
import { type ResetPoort, verwerk, type Voorbereiding } from './handler.ts';

const ORIGINS = new Set<string>();
const IK = '33333333-3333-4333-8333-333333333333';
const ANDER = '44444444-4444-4444-8444-444444444444';

interface Stand {
  eigenId: string | null;
  magBeheren: boolean;
  voorbereiding: Voorbereiding;
  wachtwoordFaalt: boolean;
  stappen: string[];
}

function stand(over: Partial<Stand> = {}): Stand {
  return {
    eigenId: IK,
    magBeheren: true,
    voorbereiding: 'ok',
    wachtwoordFaalt: false,
    stappen: [],
    ...over,
  };
}

function poort(s: Stand): ResetPoort {
  return {
    eigenGebruikerId: () => Promise.resolve(s.eigenId),
    magBeheren: () => Promise.resolve(s.magBeheren),
    voorbereiden: (id) => {
      s.stappen.push(`voorbereiden:${id}`);
      return Promise.resolve(s.voorbereiding);
    },
    verwijderFactoren: (id) => {
      s.stappen.push(`factoren:${id}`);
      return Promise.resolve();
    },
    zetWachtwoord: (id) => {
      if (s.wachtwoordFaalt) return Promise.reject(new Error('fout'));
      s.stappen.push(`wachtwoord:${id}`);
      return Promise.resolve();
    },
    zetWachtwoordVlag: (id) => {
      s.stappen.push(`vlag:${id}`);
      return Promise.resolve();
    },
  };
}

function verzoek(body: unknown, token: string | null = 'jwt'): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return new Request('http://localhost/account-resetten', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

async function antwoord(s: Stand, req = verzoek({ gebruiker_id: ANDER })) {
  const res = await verwerk(req, ORIGINS, () => poort(s));
  return { status: res.status, body: await res.json() };
}

Deno.test('zonder token of met ongeldig token: 401', async () => {
  assertEquals((await antwoord(stand(), verzoek({ gebruiker_id: ANDER }, null))).status, 401);
  const s = stand({ eigenId: null });
  assertEquals((await antwoord(s)).status, 401);
  assertEquals(s.stappen, []);
});

Deno.test('eigen account resetten: 403, ook voor manager en beheerder, zonder enige actie', async () => {
  const s = stand({ magBeheren: true });
  const { status, body } = await antwoord(s, verzoek({ gebruiker_id: IK }));
  assertEquals(status, 403);
  assert(body.fout.includes('eigen account'));
  assertEquals(s.stappen, []);
});

Deno.test('zonder recht (lmc, coordinator of aal1): 403 zonder enige actie', async () => {
  const s = stand({ magBeheren: false });
  assertEquals((await antwoord(s)).status, 403);
  assertEquals(s.stappen, []);
});

Deno.test('database weigert (bijv. beheerder resetten als manager): 403', async () => {
  const s = stand({ voorbereiding: 'geweigerd' });
  assertEquals((await antwoord(s)).status, 403);
  assertEquals(s.stappen, [`voorbereiden:${ANDER}`]);
});

Deno.test('onbekend account: 404', async () => {
  assertEquals((await antwoord(stand({ voorbereiding: 'onbekend' }))).status, 404);
});

Deno.test('ongeldige invoer: 400', async () => {
  assertEquals((await antwoord(stand(), verzoek({ gebruiker_id: 'x' }))).status, 400);
  assertEquals((await antwoord(stand(), verzoek({}))).status, 400);
});

Deno.test('geslaagd: eerst voorbereiden, dan factoren weg, wachtwoord, en de vlag weer aan', async () => {
  const s = stand();
  const { status, body } = await antwoord(s);
  assertEquals(status, 200);
  assertEquals(body.tijdelijk_wachtwoord.length, 20);
  assertEquals(s.stappen, [
    `voorbereiden:${ANDER}`,
    `factoren:${ANDER}`,
    `wachtwoord:${ANDER}`,
    `vlag:${ANDER}`,
  ]);
});

Deno.test('mislukte admin-stap: 500 zonder wachtwoord in het antwoord', async () => {
  const s = stand({ wachtwoordFaalt: true });
  const { status, body } = await antwoord(s);
  assertEquals(status, 500);
  assert(!('tijdelijk_wachtwoord' in body));
});
