// Edge Function matt-import (SPEC §8). Alleen voor coordinator, manager en beheerder
// op aal2. Het bestand komt als ruwe XML in de body; de periode in de headers
// X-Periode-Van en X-Periode-Tot (niet in de URL). Het bestand wordt niet bewaard.
import { z } from 'npm:zod@4.6.7';
import { bearerToken, fout, json, preflight } from '../_gedeeld/http.ts';
import { controleerPeriode, ImportFout, MAX_BYTES, parseMatt, type Regel } from './parser.ts';

const periodeSchema = z
  .object({
    van: z.iso.date(),
    tot: z.iso.date(),
  })
  .refine((p) => p.tot >= p.van, 'De einddatum ligt voor de begindatum.');

export interface NietGematcht {
  naam: string;
  aantal: number;
  uren: number;
}

export interface ImportPoort {
  /** Via de JWT van de aanroeper: coordinator, manager of beheerder op aal2? */
  magImporteren(): Promise<boolean>;
  /** RPC matt_import_concept_opslaan met de JWT van de aanroeper. */
  conceptOpslaan(van: string, tot: string, regels: Regel[]): Promise<Record<string, unknown>>;
  nietGematcht(importId: string): Promise<NietGematcht[]>;
}

export async function verwerk(
  req: Request,
  origins: Set<string>,
  maakPoort: (token: string) => ImportPoort,
): Promise<Response> {
  const voor = preflight(req, origins);
  if (voor) return voor;
  if (req.method !== 'POST') return fout(req, origins, 405, 'Alleen POST is toegestaan.');

  const token = bearerToken(req);
  if (!token) return fout(req, origins, 401, 'Niet ingelogd.');
  const poort = maakPoort(token);
  if (!(await poort.magImporteren())) {
    return fout(req, origins, 403, 'Geen recht om MATT-exports te importeren.');
  }

  const lengte = Number(req.headers.get('Content-Length') ?? '0');
  if (lengte > MAX_BYTES) return fout(req, origins, 413, 'Het bestand is groter dan 10 MB.');

  const periode = periodeSchema.safeParse({
    van: req.headers.get('X-Periode-Van'),
    tot: req.headers.get('X-Periode-Tot'),
  });
  if (!periode.success) return fout(req, origins, 400, 'Geef een geldige periode op.');

  try {
    const xml = await req.text();
    const { regels, eindtotaal, projecten } = parseMatt(xml);
    controleerPeriode(regels, periode.data.van, periode.data.tot);
    const voorvertoning = await poort.conceptOpslaan(periode.data.van, periode.data.tot, regels);
    const importId = String(voorvertoning.import_id);
    const nietGematcht = await poort.nietGematcht(importId);
    return json(req, origins, 200, {
      ...voorvertoning,
      bestand: { regels: regels.length, projecten, eindtotaal },
      niet_gematcht: nietGematcht,
    });
  } catch (e) {
    if (e instanceof ImportFout) return fout(req, origins, e.status, e.message);
    return fout(req, origins, 500, 'De import kon niet worden verwerkt.');
  }
}
