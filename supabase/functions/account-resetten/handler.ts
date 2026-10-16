// Edge Function account-resetten (SPEC §7).
// Alleen voor manager en beheerder op aal2. Verwijdert alle MFA-factoren, zet een
// nieuw tijdelijk wachtwoord en logt de reset. Een gebruiker kan zijn eigen account
// niet resetten (gecontroleerd hier én in de database).
import { z } from 'npm:zod@4.6.7';
import { bearerToken, fout, json, leesJson, preflight } from '../_gedeeld/http.ts';
import { genereerWachtwoord } from '../_gedeeld/wachtwoord.ts';

export const invoerSchema = z.object({ gebruiker_id: z.uuid() });

export type Voorbereiding = 'ok' | 'geweigerd' | 'onbekend';

export interface ResetPoort {
  /** Gebruiker-ID uit de (door Supabase gecontroleerde) JWT van de aanroeper. */
  eigenGebruikerId(): Promise<string | null>;
  magBeheren(): Promise<boolean>;
  /** RPC account_reset_voorbereiden met de JWT van de aanroeper: rechten, vlag, sessies, audit. */
  voorbereiden(gebruikerId: string): Promise<Voorbereiding>;
  /** Admin-API. */
  verwijderFactoren(gebruikerId: string): Promise<void>;
  /** Admin-API. */
  zetWachtwoord(gebruikerId: string, wachtwoord: string): Promise<void>;
  /** Zet moet_wachtwoord_wijzigen weer op true (de trigger zette hem op false). */
  zetWachtwoordVlag(gebruikerId: string): Promise<void>;
}

export async function verwerk(
  req: Request,
  origins: Set<string>,
  maakPoort: (token: string) => ResetPoort,
): Promise<Response> {
  const voor = preflight(req, origins);
  if (voor) return voor;
  if (req.method !== 'POST') return fout(req, origins, 405, 'Alleen POST is toegestaan.');

  const token = bearerToken(req);
  if (!token) return fout(req, origins, 401, 'Niet ingelogd.');
  const poort = maakPoort(token);

  const eigenId = await poort.eigenGebruikerId();
  if (!eigenId) return fout(req, origins, 401, 'Niet ingelogd.');

  const invoer = invoerSchema.safeParse(await leesJson(req));
  if (!invoer.success) return fout(req, origins, 400, 'Ongeldige invoer.');
  const { gebruiker_id } = invoer.data;

  if (gebruiker_id === eigenId) {
    return fout(req, origins, 403, 'Je kunt je eigen account niet resetten.');
  }
  if (!(await poort.magBeheren())) {
    return fout(
      req,
      origins,
      403,
      'Geen recht om accounts te resetten (tweestapsverificatie vereist).',
    );
  }

  const voorbereiding = await poort.voorbereiden(gebruiker_id);
  if (voorbereiding === 'geweigerd') {
    return fout(req, origins, 403, 'Je mag dit account niet resetten.');
  }
  if (voorbereiding === 'onbekend') return fout(req, origins, 404, 'Onbekend account.');

  // Vanaf hier is de gebruiker al afgesloten (vlag aan, sessies weg). Gaat een
  // volgende stap mis, dan blijft het account dus veilig geblokkeerd.
  const wachtwoord = genereerWachtwoord();
  try {
    await poort.verwijderFactoren(gebruiker_id);
    await poort.zetWachtwoord(gebruiker_id, wachtwoord);
    await poort.zetWachtwoordVlag(gebruiker_id);
  } catch {
    return fout(req, origins, 500, 'De reset is niet volledig gelukt. Probeer het opnieuw.');
  }

  return json(req, origins, 200, { gebruiker_id, tijdelijk_wachtwoord: wachtwoord });
}
