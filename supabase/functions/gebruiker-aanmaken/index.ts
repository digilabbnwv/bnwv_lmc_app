// Koppelt de handler aan de echte Supabase-clients.
import { adminClient, foutcode, gebruikerClient } from '../_gedeeld/clients.ts';
import { toegestaneOrigins } from '../_gedeeld/http.ts';
import { type AanmaakPoort, verwerk } from './handler.ts';

const origins = toegestaneOrigins(Deno.env.get('TOEGESTANE_ORIGINS'));

function maakPoort(token: string): AanmaakPoort {
  const gebruiker = gebruikerClient(token);
  const admin = adminClient();
  return {
    async magBeheren() {
      const { data, error } = await gebruiker.rpc('mag_gebruikers_beheren');
      return !error && data === true;
    },
    async zoekMedewerker(id) {
      const { data } = await gebruiker
        .from('medewerker')
        .select('id, email, actief')
        .eq('id', id)
        .maybeSingle();
      return data ?? null;
    },
    async heeftAccount(medewerkerId) {
      const { count } = await gebruiker
        .from('profiel')
        .select('gebruiker_id', { count: 'exact', head: true })
        .eq('medewerker_id', medewerkerId);
      return (count ?? 0) > 0;
    },
    async toegestaanDomein() {
      const vandaag = new Date().toISOString().slice(0, 10);
      const { data } = await gebruiker
        .from('instelling')
        .select('waarde')
        .eq('sleutel', 'toegestaan_email_domein')
        .lte('ingangsdatum', vandaag)
        .order('ingangsdatum', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data?.waarde ?? null;
    },
    async maakAuthGebruiker(email, wachtwoord) {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password: wachtwoord,
        email_confirm: true,
      });
      if (error || !data.user) throw error ?? new Error('Geen gebruiker');
      return data.user.id;
    },
    async koppel(gebruikerId, medewerkerId, rollen) {
      const profiel = await gebruiker
        .from('profiel')
        .insert({ gebruiker_id: gebruikerId, medewerker_id: medewerkerId });
      if (profiel.error) {
        if (foutcode(profiel.error) === '42501') return 'geweigerd';
        throw profiel.error;
      }
      const rol = await gebruiker
        .from('gebruiker_rol')
        .insert(rollen.map((r) => ({ gebruiker_id: gebruikerId, rol: r })));
      if (rol.error) {
        if (foutcode(rol.error) === '42501') return 'geweigerd';
        throw rol.error;
      }
      return 'ok';
    },
    async verwijderAuthGebruiker(gebruikerId) {
      await admin.auth.admin.deleteUser(gebruikerId);
    },
  };
}

Deno.serve((req) => verwerk(req, origins, maakPoort));
