import { describe, expect, it } from 'vitest';
import { codeSchema, controleerWachtwoord } from './wachtwoord';

describe('controleerWachtwoord', () => {
  it('vraagt minimaal 12 tekens', () => {
    expect(controleerWachtwoord('elf-tekens!', 'elf-tekens!')).toMatch(/12 tekens/);
    expect(controleerWachtwoord('twaalf-teken', 'twaalf-teken')).toBeNull();
  });

  it('stelt geen samenstellingseisen', () => {
    expect(controleerWachtwoord('alleenkleineletters', 'alleenkleineletters')).toBeNull();
    expect(controleerWachtwoord('lange zin met spaties', 'lange zin met spaties')).toBeNull();
  });

  it('vraagt twee keer hetzelfde wachtwoord', () => {
    expect(controleerWachtwoord('een-lang-wachtwoord', 'een-ander-wachtwoord')).toMatch(
      /niet gelijk/,
    );
  });

  it('weigert meer dan 72 bytes (bcrypt)', () => {
    const lang = 'é'.repeat(37);
    expect(controleerWachtwoord(lang, lang)).toMatch(/te lang/);
  });
});

describe('codeSchema', () => {
  it('accepteert alleen 6 cijfers', () => {
    expect(codeSchema.safeParse('123456').success).toBe(true);
    expect(codeSchema.safeParse('12345').success).toBe(false);
    expect(codeSchema.safeParse('12345a').success).toBe(false);
  });
});
