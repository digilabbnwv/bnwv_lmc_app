// Doelbinding (SPEC §1): geen beoordelende woorden in de UI en geen rood/oranje/groen.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = join(import.meta.dirname, 'src');

function bestanden(map: string): string[] {
  return readdirSync(map).flatMap((f) => {
    const p = join(map, f);
    if (statSync(p).isDirectory()) return bestanden(p);
    return /\.(tsx|ts|css)$/.test(f) && !/\.test\./.test(f) && !f.endsWith('database.types.ts')
      ? [p]
      : [];
  });
}

describe('doelbinding in de UI (SPEC §1)', () => {
  it('geen beoordelende woorden in teksten', () => {
    const verboden =
      /achterstand|te weinig|onvoldoende|ondermaats|slecht gepresteerd|tekortschiet/i;
    for (const f of bestanden(src)) expect(readFileSync(f, 'utf8'), f).not.toMatch(verboden);
  });

  it('geen rood, oranje of groen in de stijlen', () => {
    const css = readFileSync(join(src, 'stijl.css'), 'utf8');
    expect(css).not.toMatch(/\b(red|green|orange)\b|#(f00|ff0000|0f0|00ff00|ffa500)\b/i);
  });

  it('de doelbindingstekst staat letterlijk in de app', () => {
    const tekst = readFileSync(join(src, 'components', 'Doelbinding.tsx'), 'utf8');
    expect(tekst).toContain(
      'Dit overzicht is bedoeld voor capaciteitsplanning en een eerlijke werkverdeling. Het is geen middel om prestaties te beoordelen.',
    );
  });
});
