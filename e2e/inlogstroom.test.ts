// End-to-end-test van de inlogstroom tegen een volledige lokale Supabase-stack
// (SPEC §7, fase 2). Draait in CI na `supabase start`; vereist SUPABASE_URL,
// SUPABASE_ANON_KEY en SUPABASE_SERVICE_ROLE_KEY. Alleen fictieve seedgegevens.
import { assert, assertEquals, assertExists } from '@std/assert';
import { createClient, FunctionsHttpError, type SupabaseClient } from '@supabase/supabase-js';
import { totp } from './totp.ts';

const URL = Deno.env.get('SUPABASE_URL');
const ANON = Deno.env.get('SUPABASE_ANON_KEY');
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const actief = Boolean(URL && ANON && SERVICE);

const opties = { auth: { persistSession: false, autoRefreshToken: false } };
const nieuweClient = () => createClient(URL!, ANON!, opties);

async function inloggen(email: string, wachtwoord: string): Promise<SupabaseClient> {
  const client = nieuweClient();
  const { error } = await client.auth.signInWithPassword({ email, password: wachtwoord });
  if (error) throw new Error(`Inloggen ${email}: ${error.message}`);
  return client;
}

async function aal(client: SupabaseClient): Promise<string | null> {
  const { data } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
  return data?.currentLevel ?? null;
}

async function status(client: SupabaseClient) {
  const { data, error } = await client.rpc('mijn_status');
  if (error) throw error;
  return data as { moet_wachtwoord_wijzigen: boolean; heeft_toegang_na_mfa: boolean };
}

async function aantal(client: SupabaseClient, tabel: string): Promise<number> {
  const { data, error } = await client.from(tabel).select('*');
  if (error) throw error;
  return data.length;
}

/** Koppelt een TOTP-factor en verifieert hem; de sessie gaat daarmee naar aal2. */
async function koppelTotp(client: SupabaseClient, naam: string): Promise<string> {
  const { data, error } = await client.auth.mfa.enroll({ factorType: 'totp', friendlyName: naam });
  if (error) throw error;
  const code = await totp(data.totp.secret);
  const verificatie = await client.auth.mfa.challengeAndVerify({ factorId: data.id, code });
  if (verificatie.error) throw verificatie.error;
  return data.id;
}

async function aanroep(client: SupabaseClient, functie: string, body: Record<string, unknown>) {
  const { data, error } = await client.functions.invoke(functie, { body });
  if (error instanceof FunctionsHttpError) {
    const res = error.context as Response;
    return { status: res.status, data: await res.json().catch(() => null) };
  }
  if (error) throw error;
  return { status: 200, data };
}

async function medewerkerId(admin: SupabaseClient, email: string): Promise<string> {
  const { data, error } = await admin.from('medewerker').select('id').eq('email', email).single();
  if (error) throw error;
  return data.id as string;
}

Deno.test({
  name: 'inlogstroom: aal2 verplicht, wachtwoord wijzigen, TOTP, aanmaken en resetten',
  ignore: !actief,
  sanitizeOps: false,
  sanitizeResources: false,
  async fn(t) {
    const admin = createClient(URL!, SERVICE!, opties);

    // Startsituatie: een manager-account zoals een beheerder dat bij ingebruikname
    // met de hand aanmaakt (docs/SETUP.md).
    const managerEmail = 'fatima.elamrani@voorbeeld.test';
    const managerTijdelijk = 'Tijdelijk-wachtwoord-manager-1';
    const managerNieuw = 'Eigen-gekozen-wachtwoord-manager';
    const aangemaakt = await admin.auth.admin.createUser({
      email: managerEmail,
      password: managerTijdelijk,
      email_confirm: true,
    });
    if (aangemaakt.error) throw aangemaakt.error;
    const managerId = aangemaakt.data.user.id;
    const managerMw = await medewerkerId(admin, managerEmail);
    assertEquals(
      (await admin.from('profiel').insert({ gebruiker_id: managerId, medewerker_id: managerMw }))
        .error,
      null,
    );
    assertEquals(
      (await admin.from('gebruiker_rol').insert({ gebruiker_id: managerId, rol: 'manager' })).error,
      null,
    );

    let manager!: SupabaseClient;

    await t.step('op aal1 met een tijdelijk wachtwoord is er geen enkele toegang', async () => {
      manager = await inloggen(managerEmail, managerTijdelijk);
      assertEquals(await aal(manager), 'aal1');
      assertEquals(await status(manager), {
        moet_wachtwoord_wijzigen: true,
        heeft_toegang_na_mfa: true,
      });
      for (const tabel of ['medewerker', 'contract', 'toewijzing', 'schooljaar', 'auditlog']) {
        assertEquals(await aantal(manager, tabel), 0, tabel);
      }
    });

    await t.step('wachtwoord wijzigen zet de verplichting uit', async () => {
      const kort = await manager.auth.updateUser({ password: 'te-kort' });
      assertExists(kort.error, 'een wachtwoord korter dan 12 tekens wordt geweigerd');
      const { error } = await manager.auth.updateUser({ password: managerNieuw });
      assertEquals(error, null);
      assertEquals((await status(manager)).moet_wachtwoord_wijzigen, false);
      assertEquals(await aantal(manager, 'medewerker'), 0, 'nog steeds aal1: geen toegang');
    });

    await t.step('na het koppelen van TOTP (aal2) is er wel toegang', async () => {
      await koppelTotp(manager, 'Telefoon');
      assertEquals(await aal(manager), 'aal2');
      assert((await aantal(manager, 'medewerker')) >= 5);
      assert((await aantal(manager, 'schooljaar')) >= 2);
    });

    await t.step('een tweede toestel koppelen kan op aal2', async () => {
      await koppelTotp(manager, 'Reservetoestel');
      const { data } = await manager.auth.mfa.listFactors();
      assertEquals(data?.totp.filter((f) => f.status === 'verified').length, 2);
    });

    await t.step('met dezelfde gebruiker op aal1 kan geen account worden aangemaakt', async () => {
      const opAal1 = await inloggen(managerEmail, managerNieuw);
      assertEquals(await aal(opAal1), 'aal1');
      const lotte = await medewerkerId(admin, 'lotte.visser@voorbeeld.test');
      const res = await aanroep(opAal1, 'gebruiker-aanmaken', {
        medewerker_id: lotte,
        rollen: ['lmc'],
      });
      assertEquals(res.status, 403);
      assertEquals(await aantal(opAal1, 'medewerker'), 0);
    });

    await t.step('een e-mailadres buiten het toegestane domein wordt geweigerd', async () => {
      const { data, error } = await manager
        .from('medewerker')
        .insert({ voornaam: 'Extern', achternaam: 'Persoon', email: 'extern@ander.nl' })
        .select('id')
        .single();
      assertEquals(error, null);
      const res = await aanroep(manager, 'gebruiker-aanmaken', {
        medewerker_id: data!.id,
        rollen: ['lmc'],
      });
      assertEquals(res.status, 400);
    });

    const lotteEmail = 'lotte.visser@voorbeeld.test';
    let lotteId = '';
    let lotteTijdelijk = '';
    let lotte!: SupabaseClient;

    await t.step('manager maakt een account aan; het wachtwoord komt één keer terug', async () => {
      const lotteMw = await medewerkerId(admin, lotteEmail);
      const res = await aanroep(manager, 'gebruiker-aanmaken', {
        medewerker_id: lotteMw,
        rollen: ['lmc'],
      });
      assertEquals(res.status, 201);
      lotteId = res.data.gebruiker_id;
      lotteTijdelijk = res.data.tijdelijk_wachtwoord;
      assertEquals(lotteTijdelijk.length, 20);
      const nogEens = await aanroep(manager, 'gebruiker-aanmaken', {
        medewerker_id: lotteMw,
        rollen: ['lmc'],
      });
      assertEquals(nogEens.status, 409, 'een tweede account voor dezelfde medewerker kan niet');
    });

    await t.step('een manager kan geen beheerder aanmaken', async () => {
      const kees = await medewerkerId(admin, 'kees.vandijk@voorbeeld.test');
      const res = await aanroep(manager, 'gebruiker-aanmaken', {
        medewerker_id: kees,
        rollen: ['beheerder'],
      });
      assertEquals(res.status, 403);
      const { data } = await admin.auth.admin.listUsers();
      assert(!data.users.some((u) => u.email === 'kees.vandijk@voorbeeld.test'));
    });

    await t.step('nieuwe lmc: eerst wachtwoord en TOTP, daarna alleen eigen gegevens', async () => {
      lotte = await inloggen(lotteEmail, lotteTijdelijk);
      assertEquals((await status(lotte)).moet_wachtwoord_wijzigen, true);
      assertEquals(await aantal(lotte, 'contract'), 0);
      assertEquals(
        (await lotte.auth.updateUser({ password: 'Lottes-eigen-wachtwoord-1' })).error,
        null,
      );
      await koppelTotp(lotte, 'Telefoon');
      assertEquals(await aal(lotte), 'aal2');
      assertEquals(await aantal(lotte, 'medewerker'), 1, 'alleen zichzelf');
      assertEquals(await aantal(lotte, 'contract'), 1, 'alleen het eigen contract');
      assertEquals(await aantal(lotte, 'auditlog'), 0);
    });

    await t.step('niemand kan zijn eigen account resetten', async () => {
      assertEquals(
        (await aanroep(manager, 'account-resetten', { gebruiker_id: managerId })).status,
        403,
      );
      assertEquals(
        (await aanroep(lotte, 'account-resetten', { gebruiker_id: lotteId })).status,
        403,
      );
      const { data } = await admin.auth.admin.mfa.listFactors({ userId: managerId });
      assertEquals(data?.factors.length, 2, 'de factoren van de manager zijn er nog');
    });

    await t.step('een lmc kan geen account van een ander resetten', async () => {
      assertEquals(
        (await aanroep(lotte, 'account-resetten', { gebruiker_id: managerId })).status,
        403,
      );
    });

    await t.step('reset door de manager: factoren weg, sessies weg, nieuw wachtwoord', async () => {
      const res = await aanroep(manager, 'account-resetten', { gebruiker_id: lotteId });
      assertEquals(res.status, 200);
      const nieuw = res.data.tijdelijk_wachtwoord as string;

      const factoren = await admin.auth.admin.mfa.listFactors({ userId: lotteId });
      assertEquals(factoren.data?.factors.length, 0);

      // Het oude access token is nog niet verlopen, maar geeft geen toegang meer.
      assertEquals(await aantal(lotte, 'contract'), 0);
      // De oude sessie kan niet meer worden ververst.
      const ververst = await lotte.auth.refreshSession();
      assertExists(ververst.error);

      const opnieuw = await inloggen(lotteEmail, nieuw);
      assertEquals(await aal(opnieuw), 'aal1');
      assertEquals((await status(opnieuw)).moet_wachtwoord_wijzigen, true);

      const { data } = await manager
        .from('auditlog')
        .select('actie, gebruiker_id, record_id')
        .eq('actie', 'account_reset')
        .eq('record_id', lotteId);
      assertEquals(data?.length, 1);
      assertEquals(data?.[0]?.gebruiker_id, managerId);
    });

    await t.step('deactiveren trekt de toegang direct in', async () => {
      const kort = await inloggen(
        lotteEmail,
        await (async () => {
          // Nieuw tijdelijk wachtwoord, zodat Lotte een verse sessie heeft.
          const r = await aanroep(manager, 'account-resetten', { gebruiker_id: lotteId });
          return r.data.tijdelijk_wachtwoord as string;
        })(),
      );
      const lotteMw = await medewerkerId(admin, lotteEmail);
      const { error } = await manager
        .from('medewerker')
        .update({ actief: false })
        .eq('id', lotteMw);
      assertEquals(error, null);
      assertExists((await kort.auth.refreshSession()).error, 'sessie is beëindigd');
      assertEquals((await status(kort)).heeft_toegang_na_mfa, false);
    });
  },
});
