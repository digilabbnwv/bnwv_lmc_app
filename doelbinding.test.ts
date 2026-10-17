// Doelbinding (SPEC §1): geen beoordelende woorden in de UI en geen rood/oranje/groen.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = join(import.meta.dirname, 'src');

/** Het enige toegestane oranje: het merkoranje uit de huisstijlgids, alleen als accent. */
const MERK_ORANJE = '#ec7404';

/** Verzadigde tinten in het rode, oranje of groene bereik (grijs en beige mogen). */
function beoordelendeTint(hex: string): boolean {
  const h = hex.length === 4 ? hex.slice(1).replace(/./g, (c) => c + c) : hex.slice(1);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as [
    number,
    number,
    number,
  ];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const verzadiging = max === 0 ? 0 : (max - min) / max;
  if (verzadiging < 0.35 || max < 0.25) return false;
  let tint: number;
  if (max === r) tint = (60 * ((g - b) / (max - min)) + 360) % 360;
  else if (max === g) tint = 60 * ((b - r) / (max - min)) + 120;
  else tint = 60 * ((r - g) / (max - min)) + 240;
  return tint < 50 || tint > 330 || (tint > 70 && tint < 170);
}

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
  const cssBestanden = bestanden(src).filter((f) => f.endsWith('.css'));

  it('controleert alle stijlbestanden', () => {
    expect(cssBestanden.length).toBeGreaterThanOrEqual(5);
  });

  it('geen beoordelende woorden in teksten', () => {
    const verboden =
      /achterstand|achterloop|achter op schema|te laat|te weinig|onvoldoende|ondermaats|slecht gepresteerd|tekortschiet/i;
    for (const f of bestanden(src)) expect(readFileSync(f, 'utf8'), f).not.toMatch(verboden);
  });

  it('geen rood, oranje of groen in de stijlen', () => {
    for (const f of cssBestanden) {
      const css = readFileSync(f, 'utf8');
      expect(css, f).not.toMatch(/\b(red|green|orange)\b/i);
      for (const [hex] of css.matchAll(/#[0-9a-f]{6}\b|#[0-9a-f]{3}\b/gi)) {
        if (hex.toLowerCase() === MERK_ORANJE && f.endsWith('tokens.css')) continue;
        expect(beoordelendeTint(hex), `${hex} in ${f}`).toBe(false);
      }
    }
  });

  it('het merkoranje staat alleen als token en alleen in kop en navigatie', () => {
    for (const f of cssBestanden) {
      const css = readFileSync(f, 'utf8');
      if (!f.endsWith('tokens.css')) expect(css.toLowerCase(), f).not.toContain(MERK_ORANJE);
      for (const m of css.matchAll(/([^{}]+)\{[^{}]*var\(--merk-oranje\)[^{}]*\}/g)) {
        const selectors = (m[1] as string).replace(/\/\*[\s\S]*?\*\//g, '').split(',');
        for (const sel of selectors) expect(sel.trim(), f).toMatch(/^\.(app-kop|navigatie)\b/);
      }
    }
  });

  it('de doelbindingstekst staat letterlijk in de app', () => {
    const tekst = readFileSync(join(src, 'components', 'Doelbinding.tsx'), 'utf8');
    expect(tekst).toContain(
      'Dit overzicht is bedoeld voor capaciteitsplanning en een eerlijke werkverdeling. Het is geen middel om prestaties te beoordelen.',
    );
  });
});

describe('hoogcontrastmodus (forced colors)', () => {
  it('zonebalk, grafiek en stappen hebben regels voor forced colors', () => {
    const css = readFileSync(join(src, 'stijl', 'hoogcontrast.css'), 'utf8');
    expect(css).toContain('@media (forced-colors: active)');
    for (const klasse of ['.zone-vulling', '.grafiek-gepland', '.stap-huidig', '.navigatie a']) {
      expect(css, klasse).toContain(klasse);
    }
  });
});

describe('doelbinding in de handleiding', () => {
  const handleiding = readFileSync(join(import.meta.dirname, 'docs', 'HANDLEIDING.md'), 'utf8');

  it('geen beoordelende woorden', () => {
    expect(handleiding).not.toMatch(
      /achterstand|achterloop|achter op schema|te laat|te weinig|onvoldoende|ondermaats|slecht gepresteerd|tekortschiet/i,
    );
  });

  it('bevat de doelbindingstekst en vermeldt dat de afbeeldingen fictief zijn', () => {
    expect(handleiding).toContain(
      'Dit overzicht is bedoeld voor capaciteitsplanning en een eerlijke werkverdeling. Het is geen middel om prestaties te beoordelen.',
    );
    expect(handleiding).toMatch(/fictieve gegevens/);
  });

  it('elke afbeelding bestaat, met een beschrijvende alt-tekst', () => {
    for (const m of handleiding.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g)) {
      expect((m[1] ?? '').length, m[2]).toBeGreaterThan(10);
      expect(statSync(join(import.meta.dirname, 'docs', m[2] ?? '')).size, m[2]).toBeLessThan(
        160_000,
      );
    }
  });
});
