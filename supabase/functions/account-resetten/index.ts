// Koppelt de handler aan de echte Supabase-clients.
import { adminClient, foutcode, gebruikerClient } from '../_gedeeld/clients.ts';
import { toegestaneOrigins } from '../_gedeeld/http.ts';
import { type ResetPoort, verwerk } from './handler.ts';

const origins = toegestaneOrigins(Deno.env.get('TOEGESTANE_ORIGINS'));

function maakPoort(token: string): ResetPoort {
  const gebruiker = gebruikerClient(token);
  const admin = adminClient();
  return {
    async eigenGebruikerId() {
      const { data, error } = await gebruiker.auth.getUser(token);
      return error ? null : (data.user?.id ?? null);
    },
    async magBeheren() {
      const { data, error } = await gebruiker.rpc('mag_gebruikers_beheren');
      return !error && data === true;
    },
    async voorbereiden(gebruikerId) {
      const { error } = await gebruiker.rpc('account_reset_voorbereiden', {
        p_gebruiker_id: gebruikerId,
      });
      if (!error) return 'ok';
      const code = foutcode(error);
      if (code === '42501') return 'geweigerd';
      if (code === 'P0002') return 'onbekend';
      throw error;
    },
    async verwijderFactoren(gebruikerId) {
      const { data, error } = await admin.auth.admin.mfa.listFactors({ userId: gebruikerId });
      if (error) throw error;
      for (const factor of data.factors) {
        const verwijderd = await admin.auth.admin.mfa.deleteFactor({
          id: factor.id,
          userId: gebruikerId,
        });
        if (verwijderd.error) throw verwijderd.error;
      }
    },
    async zetWachtwoord(gebruikerId, wachtwoord) {
      const { error } = await admin.auth.admin.updateUserById(gebruikerId, {
        password: wachtwoord,
      });
      if (error) throw error;
    },
    async zetWachtwoordVlag(gebruikerId) {
      const { error } = await admin
        .from('profiel')
        .update({ moet_wachtwoord_wijzigen: true })
        .eq('gebruiker_id', gebruikerId);
      if (error) throw error;
    },
  };
}

Deno.serve((req) => verwerk(req, origins, maakPoort));
