// Bouwstenen voor zod-schema's van beheerformulieren. Formulierwaarden zijn tekst
// (of een vinkje); deze bouwstenen zetten ze om en controleren ze, in lijn met de
// constraints in de database (die blijft beslissen).
import { z } from 'zod';

export type Formulierwaarden = Record<string, string | boolean>;

const leeg = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? null : v);

export const v = {
  tekst: (max = 200, melding = 'Dit veld is verplicht.') =>
    z
      .string()
      .trim()
      .min(1, melding)
      .max(max, `Maximaal ${String(max)} tekens.`),

  optioneleTekst: (max = 200) =>
    z.preprocess(
      leeg,
      z
        .string()
        .trim()
        .max(max, `Maximaal ${String(max)} tekens.`)
        .nullable(),
    ),

  getal: (opties: { min?: number; max?: number; geheel?: boolean } = {}) =>
    z.preprocess(
      (w) =>
        typeof w === 'string' ? (w.trim() === '' ? undefined : Number(w.replace(',', '.'))) : w,
      z
        .number({ message: 'Vul een getal in.' })
        .refine((n) => !Number.isNaN(n), 'Vul een getal in.')
        .refine((n) => !opties.geheel || Number.isInteger(n), 'Vul een geheel getal in.')
        .refine(
          (n) => opties.min === undefined || n >= opties.min,
          `Minimaal ${String(opties.min)}.`,
        )
        .refine(
          (n) => opties.max === undefined || n <= opties.max,
          `Maximaal ${String(opties.max)}.`,
        ),
    ),

  optioneelGetal: (opties: { min?: number; max?: number; geheel?: boolean } = {}) =>
    z.preprocess(leeg, v.getal(opties).nullable()),

  datum: () =>
    z.string({ message: 'Vul een datum in.' }).regex(/^\d{4}-\d{2}-\d{2}$/, 'Vul een datum in.'),

  optioneleDatum: () => z.preprocess(leeg, v.datum().nullable()),

  vinkje: () => z.boolean(),

  keuze: <T extends string>(waarden: readonly [T, ...T[]], melding = 'Maak een keuze.') =>
    z.enum(waarden, { message: melding }),

  optioneleKeuze: () => z.preprocess(leeg, z.string().nullable()),

  /** Komma-gescheiden ISO-datums (datumlijst-veld). */
  datumlijst: () =>
    z.preprocess(
      (w) =>
        typeof w === 'string'
          ? w
              .split(',')
              .map((d) => d.trim())
              .filter((d) => d.length > 0)
          : w,
      z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ongeldige datum.')),
    ),
};

/** Fouten per veld uit een zod-resultaat. */
export function foutenPerVeld(fout: z.ZodError): Record<string, string> {
  const uit: Record<string, string> = {};
  for (const issue of fout.issues) {
    const veld = String(issue.path[0] ?? '_');
    uit[veld] ??= issue.message;
  }
  return uit;
}
