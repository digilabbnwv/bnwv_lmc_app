import { z } from 'zod';

/**
 * Nieuw wachtwoord: minimaal 12 tekens, geen samenstellingsregels (SPEC §7).
 * Maximaal 72 bytes: Supabase Auth gebruikt bcrypt.
 */
export const wachtwoordSchema = z
  .object({
    wachtwoord: z
      .string()
      .min(12, 'Kies een wachtwoord van minimaal 12 tekens.')
      .refine((w) => new TextEncoder().encode(w).length <= 72, 'Het wachtwoord is te lang.'),
    herhaling: z.string(),
  })
  .refine((v) => v.wachtwoord === v.herhaling, {
    message: 'De wachtwoorden zijn niet gelijk.',
    path: ['herhaling'],
  });

/** Eerste foutmelding, of null als het wachtwoord geldig is. */
export function controleerWachtwoord(wachtwoord: string, herhaling: string): string | null {
  const resultaat = wachtwoordSchema.safeParse({ wachtwoord, herhaling });
  return resultaat.success ? null : (resultaat.error.issues[0]?.message ?? 'Ongeldig wachtwoord.');
}

export const codeSchema = z
  .string()
  .regex(/^\d{6}$/, 'Vul de 6 cijfers uit je authenticator-app in.');
