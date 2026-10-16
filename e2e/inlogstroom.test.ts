// End-to-end-test van de inlogstroom tegen een volledige lokale Supabase-stack
// (SPEC §7, fase 2). Draait in CI na `supabase start`; vereist SUPABASE_URL,
// SUPABASE_ANON_KEY en SUPABASE_SERVICE_ROLE_KEY. Alleen fictieve seedgegevens.
import { assert, assertEquals, assertExists } from '@std/assert';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { totp } from './totp.ts';
import { parseMatt } from '../supabase/functions/matt-import/parser.ts';

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

/** Roept een Edge Function aan met de sessie van de client; geeft de echte HTTP-status. */
async function aanroep(client: SupabaseClient, functie: string, body: Record<string, unknown>) {
  const { data: sessie } = await client.auth.getSession();
  const token = sessie.session?.access_token;
  if (!token) throw new Error('Geen sessie');
  const res = await fetch(`${URL}/functions/v1/${functie}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: ANON!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  return { status: res.status, data: await res.json().catch(() => null) };
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

    await t.step('zelf registreren is uitgeschakeld', async () => {
      const { data, error } = await nieuweClient().auth.signUp({
        email: 'kees.vandijk@voorbeeld.test',
        password: 'Een-wachtwoord-om-te-registreren',
      });
      assertExists(error, 'registreren moet worden geweigerd');
      assertEquals(data.user, null);
      const { data: lijst } = await admin.auth.admin.listUsers();
      assert(!lijst.users.some((u) => u.email === 'kees.vandijk@voorbeeld.test'));
    });

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

    await t.step(
      'beheer: school, leerlingen en toewijzing tellen mee in de belasting',
      async () => {
        const sj = await manager.from('schooljaar').select('id').eq('naam', '2026-2027').single();
        assertEquals(sj.error, null);
        const schooljaarId = sj.data!.id as string;

        const school = await manager.rpc('school_opslaan', {
          p_werkpakket_id: null,
          p_naam: 'E2E-school',
          p_vestiging: 'HAR',
          p_actief: true,
          p_schooltype: 'PO',
          p_adres: null,
          p_postcode: '1234 AB',
          p_plaats: 'Harderwijk',
        });
        assertEquals(school.error, null);
        const schoolId = school.data as string;

        // Seed: staffel PO 201–400 leerlingen = 50 uur, opslagfactor 2,0 → 100 uur.
        assertEquals(
          (await manager.from('school_schooljaar').insert({
            school_id: schoolId,
            schooljaar_id: schooljaarId,
            aantal_leerlingen: 250,
          })).error,
          null,
        );

        const gepland = async () => {
          const { data, error } = await manager
            .rpc('belasting', { p_van: '2026-08-01', p_tot: '2027-07-31' })
            .eq('medewerker_id', managerMw);
          if (error) throw error;
          return Number((data as { gepland: number }[])[0]?.gepland ?? 0);
        };
        const voor = await gepland();
        assertEquals(
          (await manager.from('toewijzing').insert({
            medewerker_id: managerMw,
            werkpakket_id: schoolId,
            schooljaar_id: schooljaarId,
            bron: 'staffel',
            verdeling: 'schoolweken',
          })).error,
          null,
        );
        assertEquals(Math.round(((await gepland()) - voor) * 10000) / 10000, 100);
      },
    );

    await t.step('beheer: configuratie kopiëren naar een nieuw schooljaar', async () => {
      const bron = await manager.from('schooljaar').select('id').eq('naam', '2026-2027').single();
      const nieuw = await manager
        .from('schooljaar')
        .insert({ naam: '2027-2028', startdatum: '2027-08-01', einddatum: '2028-07-31' })
        .select('id')
        .single();
      assertEquals(nieuw.error, null);
      const { data, error } = await manager.rpc('schooljaar_configuratie_kopieren', {
        p_van_id: bron.data!.id,
        p_naar_id: nieuw.data!.id,
      });
      assertEquals(error, null);
      const r = data as { staffel: number; opslagfactor: number; schoolvakantie: number };
      assert(r.staffel > 0 && r.opslagfactor > 0 && r.schoolvakantie > 0);
    });

    const fixture = await Deno.readTextFile(
      new globalThis.URL('../fixtures/matt-export-synthetisch.xml', import.meta.url),
    );
    const importeer = async (client: SupabaseClient, xml: string, van: string, tot: string) => {
      const { data: sessie } = await client.auth.getSession();
      const res = await fetch(`${URL}/functions/v1/matt-import`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${sessie.session?.access_token ?? ''}`,
          apikey: ANON!,
          'Content-Type': 'application/xml',
          'X-Periode-Van': van,
          'X-Periode-Tot': tot,
        },
        body: xml,
      });
      return { status: res.status, data: await res.json().catch(() => null) };
    };
    const fixtureMedewerkers = async () => {
      const { data } = await admin
        .from('medewerker_alias')
        .select('medewerker_id')
        .eq('bron', 'matt');
      return (data ?? []).map((a) => a.medewerker_id as string);
    };
    const gerealiseerdAantal = async () => {
      const { data, error } = await manager
        .from('gerealiseerd')
        .select('boeking_id')
        .in('medewerker_id', await fixtureMedewerkers())
        .gte('datum', '2026-01-01')
        .lte('datum', '2026-03-31');
      if (error) throw error;
      return data.length;
    };

    await t.step('MATT-import: weigeringen (aal1, DOCTYPE, periode)', async () => {
      const opAal1 = await inloggen(managerEmail, managerNieuw);
      assertEquals((await importeer(opAal1, fixture, '2026-01-01', '2026-03-31')).status, 403);
      const doctype = fixture.replace('?>', '?><!DOCTYPE Report [<!ENTITY a "b">]>');
      assertEquals((await importeer(manager, doctype, '2026-01-01', '2026-03-31')).status, 400);
      const buiten = await importeer(manager, fixture, '2026-02-01', '2026-03-31');
      assertEquals(buiten.status, 400);
      assert(String(buiten.data?.fout).includes('buiten de periode'));
    });

    let importId = '';
    await t.step('MATT-import: voorvertoning van de synthetische fixture', async () => {
      const { status, data } = await importeer(manager, fixture, '2026-01-01', '2026-03-31');
      if (status !== 200) {
        // Diagnose: dezelfde RPC rechtstreeks, zodat de volledige Postgres-melding zichtbaar is.
        const regels = parseMatt(fixture).regels.map(({ verwerkt: _v, nacalc: _n, ...r }) => r);
        const direct = await manager.rpc('matt_import_concept_opslaan', {
          p_periode_van: '2026-01-01',
          p_periode_tot: '2026-03-31',
          p_regels: regels,
        });
        throw new Error(
          `Import ${status}: ${JSON.stringify(data)}; direct: ${JSON.stringify(direct.error)}`,
        );
      }
      importId = data.import_id;
      assertEquals(data.bestand.regels, 79);
      assertEquals(data.bestand.eindtotaal.uren, 171.75);
      assertEquals(data.medewerkers.length, 5, 'de vijf fictieve medewerkers zijn gematcht');
      assertEquals(data.niet_gematcht_aantal, 1);
      assertEquals(data.niet_gematcht[0].naam, 'Testpersoon Onbekend');
      assert(
        data.niet_gekoppelde_projecten.some((p: { projectnummer: string }) =>
          p.projectnummer === '999'
        ),
        'project 999 is onbekend en dus niet gekoppeld',
      );
      assertEquals(await gerealiseerdAantal(), 0, 'een concept telt nog niet mee');
    });

    await t.step(
      'MATT-import: definitief, en een tweede import geeft geen duplicaten',
      async () => {
        assertEquals(
          (await manager.rpc('matt_import_definitief_maken', { p_import_id: importId })).error,
          null,
        );
        const eerste = await gerealiseerdAantal();
        assertEquals(eerste, 78, '79 boekingen min die van Testpersoon Onbekend');

        const tweede = await importeer(manager, fixture, '2026-01-01', '2026-03-31');
        assertEquals(tweede.status, 200);
        importId = tweede.data.import_id;
        assertEquals(
          (await manager.rpc('matt_import_definitief_maken', { p_import_id: importId })).error,
          null,
        );
        assertEquals(await gerealiseerdAantal(), 78, 'na een tweede import nog steeds 78');
        const { data: niet } = await manager
          .from('matt_import_niet_gematcht')
          .select('naam')
          .eq('import_id', importId);
        assertEquals(niet?.length, 0, 'niet-gematchte namen zijn na definitief maken weg');
      },
    );

    await t.step('MATT-import: terugdraaien', async () => {
      assertEquals(
        (await manager.rpc('matt_import_terugdraaien', { p_import_id: importId })).error,
        null,
      );
      assertEquals(await gerealiseerdAantal(), 0, 'teruggedraaide boekingen tellen niet meer mee');
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
