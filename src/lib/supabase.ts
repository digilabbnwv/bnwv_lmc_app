import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import { leesOmgeving } from './omgeving';

export type Client = SupabaseClient<Database>;

let client: Client | undefined;

/**
 * De Supabase-client van de app. De sessie staat in localStorage; dat is het enige
 * gebruik van localStorage (SPEC §2). Tokens komen nooit in de URL.
 */
export function supabase(): Client {
  if (!client) {
    const omgeving = leesOmgeving();
    client = createClient<Database>(omgeving.VITE_SUPABASE_URL, omgeving.VITE_SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        // PKCE, zodat later een OAuth-provider kan worden toegevoegd (SPEC §7).
        flowType: 'pkce',
      },
    });
  }
  return client;
}

/** Roept een Edge Function aan; gooit een Error met de foutmelding van de functie. */
export async function roepFunctieAan<T>(naam: string, body: Record<string, unknown>): Promise<T> {
  const antwoord = await supabase().functions.invoke<T>(naam, { body });
  const fout: unknown = antwoord.error;
  if (fout || antwoord.data === null) throw new Error(await functieFout(fout));
  return antwoord.data;
}

/** Foutmelding uit een Edge Function-antwoord ({ fout: string }), of een standaardtekst. */
export async function functieFout(error: unknown): Promise<string> {
  const context = (error as { context?: unknown } | null)?.context;
  if (context instanceof Response) {
    try {
      const body = (await context.json()) as { fout?: unknown };
      if (typeof body.fout === 'string') return body.fout;
    } catch {
      // geen JSON
    }
  }
  return 'Er ging iets mis. Probeer het opnieuw.';
}

/**
 * Alleen voor de demomodus in development (src/demo): vervangt de client door een
 * nagebootste client met fictieve gegevens. In de productiebuild weigert deze functie.
 */
export function zetDemoClient(demo: Client): void {
  if (!import.meta.env.DEV) throw new Error('De demomodus bestaat alleen in development.');
  client = demo;
}
