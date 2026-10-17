// Edge Function gebruiker-aanmaken (SPEC §7).
// Alleen voor manager en beheerder op aal2. Maakt een account voor een bestaande,
// actieve medewerker zonder account, met het e-mailadres van die medewerker.
import { z } from 'npm:zod@4.6.7';
import { bearerToken, fout, json, leesJson, preflight } from '../_gedeeld/http.ts';
import { genereerWachtwoord } from '../_gedeeld/wachtwoord.ts';

export const ROLLEN = ['lmc', 'coordinator', 'manager', 'beheerder'] as const;
export type Rol = (typeof ROLLEN)[number];

export const invoerSchema = z.object({
  medewerker_id: z.uuid(),
  rollen: z
    .array(z.enum(ROLLEN))
    .min(1)
    .max(ROLLEN.length)
    .refine((r) => new Set(r).size === r.length, 'Dubbele rol'),
});

export interface Medewerker {
  id: string;
  email: string;
  actief: boolean;
}

/** Alles wat de handler van buiten nodig heeft; in tests nagebootst. */
export interface AanmaakPoort {
  /** Via de JWT van de aanroeper: manager of beheerder op aal2? */
  magBeheren(): Promise<boolean>;
  zoekMedewerker(id: string): Promise<Medewerker | null>;
  heeftAccount(medewerkerId: string): Promise<boolean>;
  toegestaanDomein(): Promise<string | null>;
  /** Admin-API. Geeft het nieuwe gebruiker-ID terug. */
  maakAuthGebruiker(email: string, wachtwoord: string): Promise<string>;
  /** Via de JWT van de aanroeper, zodat RLS de rolregels afdwingt. */
  koppel(gebruikerId: string, medewerkerId: string, rollen: Rol[]): Promise<'ok' | 'geweigerd'>;
  /** Admin-API; voor het terugdraaien als koppelen mislukt. */
  verwijderAuthGebruiker(gebruikerId: string): Promise<void>;
}

/** Vertaalt een fout van Supabase Auth (admin.createUser) naar een begrijpelijke melding. */
export function authFout(req: Request, origins: Set<string>, e: unknown): Response {
  const code = e && typeof e === 'object' && 'code' in e ? String(e.code) : 'onbekend';
  if (code === 'email_exists' || code === 'user_already_exists') {
    return fout(
      req,
      origins,
      409,
      'Er bestaat al een gebruiker met dit e-mailadres (zie Authentication → Users in Supabase).',
    );
  }
  if (code === 'weak_password') {
    return fout(
      req,
      origins,
      502,
      'Supabase weigert het tijdelijke wachtwoord vanwege het wachtwoordbeleid. Zet bij Password requirements "No required characters" (zie docs/SETUP.md).',
    );
  }
  return fout(req, origins, 502, `Supabase Auth weigerde het account (foutcode ${code}).`);
}

export function domeinVan(email: string): string {
  return email.slice(email.lastIndexOf('@') + 1).toLowerCase();
}

export async function verwerk(
  req: Request,
  origins: Set<string>,
  maakPoort: (token: string) => AanmaakPoort,
): Promise<Response> {
  const voor = preflight(req, origins);
  if (voor) return voor;
  if (req.method !== 'POST') return fout(req, origins, 405, 'Alleen POST is toegestaan.');

  const token = bearerToken(req);
  if (!token) return fout(req, origins, 401, 'Niet ingelogd.');
  const poort = maakPoort(token);

  if (!(await poort.magBeheren())) {
    return fout(
      req,
      origins,
      403,
      'Geen recht om accounts aan te maken (tweestapsverificatie vereist).',
    );
  }

  const invoer = invoerSchema.safeParse(await leesJson(req));
  if (!invoer.success) return fout(req, origins, 400, 'Ongeldige invoer.');
  const { medewerker_id, rollen } = invoer.data;

  const medewerker = await poort.zoekMedewerker(medewerker_id);
  if (!medewerker) return fout(req, origins, 404, 'Onbekende medewerker.');
  if (!medewerker.actief) return fout(req, origins, 400, 'De medewerker is niet actief.');
  if (await poort.heeftAccount(medewerker_id)) {
    return fout(req, origins, 409, 'Deze medewerker heeft al een account.');
  }

  const domein = await poort.toegestaanDomein();
  if (!domein || domeinVan(medewerker.email) !== domein.toLowerCase()) {
    return fout(req, origins, 400, 'Het e-mailadres valt niet binnen het toegestane domein.');
  }

  const wachtwoord = genereerWachtwoord();
  let gebruikerId: string;
  try {
    gebruikerId = await poort.maakAuthGebruiker(medewerker.email, wachtwoord);
  } catch (e) {
    return authFout(req, origins, e);
  }

  let koppeling: 'ok' | 'geweigerd';
  try {
    koppeling = await poort.koppel(gebruikerId, medewerker_id, rollen);
  } catch {
    await poort.verwijderAuthGebruiker(gebruikerId);
    return fout(req, origins, 500, 'Het account kon niet worden gekoppeld en is teruggedraaid.');
  }
  if (koppeling === 'geweigerd') {
    await poort.verwijderAuthGebruiker(gebruikerId);
    return fout(req, origins, 403, 'Je mag (een van) deze rollen niet toekennen.');
  }

  // Het wachtwoord wordt alleen hier, één keer, teruggegeven.
  return json(req, origins, 201, { gebruiker_id: gebruikerId, tijdelijk_wachtwoord: wachtwoord });
}
