// Supabase-clients voor Edge Functions.
// - gebruiker: met de JWT van de aanroeper; RLS en de RLS-hulpfuncties beslissen.
// - admin: met de service_role-sleutel; alleen voor de Auth-admin-API en de
//   wachtwoordvlag, en pas NA de rechtencontrole.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.118.0';

export type { SupabaseClient };

function omgeving(naam: string): string {
  const waarde = Deno.env.get(naam);
  if (!waarde) throw new Error(`Omgevingsvariabele ${naam} ontbreekt.`);
  return waarde;
}

const opties = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
};

export function gebruikerClient(token: string): SupabaseClient {
  return createClient(omgeving('SUPABASE_URL'), omgeving('SUPABASE_ANON_KEY'), {
    ...opties,
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

export function adminClient(): SupabaseClient {
  return createClient(omgeving('SUPABASE_URL'), omgeving('SUPABASE_SERVICE_ROLE_KEY'), opties);
}

/** Postgres-foutcode uit een PostgREST-fout, of null. */
export function foutcode(error: unknown): string | null {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code: unknown }).code;
    return typeof code === 'string' ? code : null;
  }
  return null;
}
