// Koppelt de handler aan de echte Supabase-client (alleen de JWT van de aanroeper;
// de database-RPC's controleren de rechten en schrijven de boekingen).
import { foutcode, gebruikerClient } from '../_gedeeld/clients.ts';
import { toegestaneOrigins } from '../_gedeeld/http.ts';
import { type ImportPoort, verwerk } from './handler.ts';
import { ImportFout } from './parser.ts';

const origins = toegestaneOrigins(Deno.env.get('TOEGESTANE_ORIGINS'));

function maakPoort(token: string): ImportPoort {
  const gebruiker = gebruikerClient(token);
  return {
    async magImporteren() {
      const { data, error } = await gebruiker.rpc('mag_matt_importeren');
      return !error && data === true;
    },
    async conceptOpslaan(van, tot, regels) {
      const { data, error } = await gebruiker.rpc('matt_import_concept_opslaan', {
        p_periode_van: van,
        p_periode_tot: tot,
        p_regels: regels.map((r) => ({
          medewerker: r.medewerker,
          projectnummer: r.projectnummer,
          projectnaam: r.projectnaam,
          artikelcode: r.artikelcode,
          datum: r.datum,
          uren: r.uren,
          uren_open: r.uren_open,
          omschrijving: r.omschrijving,
        })),
      });
      if (error) {
        const code = foutcode(error);
        if (code === '42501') {
          throw new ImportFout(403, 'Geen recht om MATT-exports te importeren.');
        }
        if (code === '22023') throw new ImportFout(400, error.message);
        throw error;
      }
      return data as Record<string, unknown>;
    },
    async nietGematcht(importId) {
      const { data, error } = await gebruiker
        .from('matt_import_niet_gematcht')
        .select('naam, aantal, uren')
        .eq('import_id', importId)
        .order('naam');
      if (error) throw error;
      return data;
    },
  };
}

Deno.serve((req) => verwerk(req, origins, maakPoort));
