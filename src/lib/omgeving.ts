import { z } from 'zod';

const schema = z.object({
  VITE_SUPABASE_URL: z.url(),
  VITE_SUPABASE_ANON_KEY: z.string().min(20),
});

export type Omgeving = z.infer<typeof schema>;

/** Leest en controleert de omgevingsvariabelen van de frontend. */
export function leesOmgeving(env: Record<string, unknown> = import.meta.env): Omgeving {
  const resultaat = schema.safeParse(env);
  if (!resultaat.success) {
    throw new Error(
      'VITE_SUPABASE_URL en VITE_SUPABASE_ANON_KEY ontbreken of zijn ongeldig (zie docs/SETUP.md).',
    );
  }
  return resultaat.data;
}
