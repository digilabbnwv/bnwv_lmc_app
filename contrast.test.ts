// Contrast van de design tokens, licht én donker (WCAG 2.1 AA: 1.4.3 tekst, 1.4.11 UI).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(join(import.meta.dirname, 'src', 'stijl', 'tokens.css'), 'utf8');

function tokens(blok: string): Map<string, string> {
  const kaart = new Map<string, string>();
  for (const m of blok.matchAll(/(--[\w-]+):\s*(#[0-9a-f]{6})\s*;/gi)) {
    kaart.set(m[1] as string, (m[2] as string).toLowerCase());
  }
  return kaart;
}

const donkerStart = css.indexOf('@media (prefers-color-scheme: dark)');
const licht = tokens(css.slice(0, donkerStart));
const donker = new Map([...licht, ...tokens(css.slice(donkerStart))]);

function luminantie(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [x, y] = [luminantie(a), luminantie(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** [voorgrond, achtergrond, minimum] */
const PAREN: [string, string, number][] = [
  ['--tekst', '--achtergrond', 4.5],
  ['--tekst', '--oppervlak', 4.5],
  ['--tekst', '--oppervlak-zacht', 4.5],
  ['--tekst', '--markering', 4.5],
  ['--gedempt', '--achtergrond', 4.5],
  ['--gedempt', '--oppervlak', 4.5],
  ['--gedempt', '--oppervlak-zacht', 4.5],
  ['--gedempt', '--markering', 4.5],
  ['--knop-tekst', '--knop-achtergrond', 4.5],
  // Randen van invoervelden en de focusring: minstens 3:1 (WCAG 1.4.11)
  ['--rand-sterk', '--oppervlak', 3],
  ['--rand-sterk', '--oppervlak-zacht', 3],
  ['--focus', '--achtergrond', 3],
  ['--focus', '--oppervlak-zacht', 3],
  ['--zone-vulling', '--oppervlak', 3],
  ['--zone-vol', '--oppervlak', 3],
  // Componenten (UI-5): focus op het actieve menu-item, arcering, grafiek en badges
  ['--focus', '--markering', 3],
  ['--focus', '--oppervlak', 3],
  ['--zone-boven-a', '--oppervlak', 3],
  ['--zone-boven-a', '--zone-boven-b', 1.5],
  ['--gedempt', '--oppervlak-zacht', 3],
  ['--zone-vol', '--oppervlak-zacht', 3],
  ['--rand-sterk', '--achtergrond', 3],
];

describe.each([
  ['licht', licht],
  ['donker', donker],
])('contrast in de %s modus', (_naam, t) => {
  it.each(PAREN)('%s op %s minstens %d:1', (voor, achter, minimum) => {
    const a = t.get(voor);
    const b = t.get(achter);
    expect(a, voor).toBeDefined();
    expect(b, achter).toBeDefined();
    expect(contrast(a as string, b as string)).toBeGreaterThanOrEqual(minimum);
  });
});

describe('huisstijl', () => {
  it('gebruikt de basiskleuren uit de huisstijlgids', () => {
    expect(licht.get('--merk-oranje')).toBe('#ec7404');
    expect(licht.get('--merk-antraciet')).toBe('#39373a');
    expect(licht.get('--merk-beige')).toBe('#fde5d0');
  });

  it('oranje haalt op wit geen 4,5:1 en is dus geen tekstkleur', () => {
    expect(contrast('#ec7404', '#ffffff')).toBeLessThan(4.5);
    for (const tekstToken of ['--tekst', '--gedempt', '--knop-tekst', '--knop-achtergrond']) {
      expect(licht.get(tekstToken)).not.toBe('#ec7404');
      expect(donker.get(tekstToken)).not.toBe('#ec7404');
    }
  });
});
