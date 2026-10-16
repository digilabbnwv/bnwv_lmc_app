import { describe, expect, it } from 'vitest';
import { vertaalFout } from './fouten';
import { formatDatum, formatPercentage, formatUren } from './opmaak';
import { rechtenVoor } from '../auth/rechten';

describe('opmaak', () => {
  it('uren met één decimaal in Nederlandse notatie', () => {
    expect(formatUren(904.3909)).toBe('904,4');
    expect(formatUren(1003.6709)).toBe('1.003,7');
    expect(formatUren(0)).toBe('0,0');
    expect(formatUren(null)).toBe('');
  });

  it('percentage en datum', () => {
    expect(formatPercentage(0.874)).toBe('87%');
    expect(formatPercentage(null)).toBe('');
    expect(formatDatum('2026-08-01')).toBe('01-08-2026');
    expect(formatDatum(null)).toBe('');
  });
});

describe('vertaalFout', () => {
  it('vertaalt de bekende foutcodes', () => {
    expect(vertaalFout({ code: '23505' })).toMatch(/bestaat al/);
    expect(vertaalFout({ code: '23P01' })).toMatch(/overlapt/);
    expect(vertaalFout({ code: '23503' })).toMatch(/nog gebruikt/);
    expect(vertaalFout({ code: '23001' })).toMatch(/nog gebruikt/);
    expect(vertaalFout({ code: '42501' })).toMatch(/geen rechten/);
  });

  it('toont eigen Nederlandse meldingen uit triggers, maar geen technische constraintnamen', () => {
    expect(
      vertaalFout({ code: '23514', message: 'De vakantie valt niet binnen het schooljaar.' }),
    ).toBe('De vakantie valt niet binnen het schooljaar.');
    expect(
      vertaalFout({
        code: '23514',
        message: 'new row violates check constraint "staffel_uren_check"',
      }),
    ).toMatch(/voldoen niet aan de regels/);
  });

  it('onbekende fouten geven een algemene melding', () => {
    expect(vertaalFout({ code: 'XX000', message: 'interne fout' })).toMatch(/Probeer het opnieuw/);
    expect(vertaalFout(new Error('Eigen melding'))).toBe('Eigen melding');
  });
});

describe('rechtenVoor (SPEC §6)', () => {
  it('lmc ziet geen beheer', () => {
    expect(rechtenVoor(['lmc']).beheer).toBe(false);
    expect(rechtenVoor([]).beheer).toBe(false);
  });

  it('coordinator: alles beheren behalve accounts', () => {
    const r = rechtenVoor(['coordinator']);
    expect([r.configuratie, r.medewerkers, r.werkBeheren, r.mattProjecten, r.accounts]).toEqual([
      true,
      true,
      true,
      true,
      false,
    ]);
  });

  it('beheerder: werk alleen inzien, wel accounts', () => {
    const r = rechtenVoor(['beheerder']);
    expect([r.werkBeheren, r.werkInzien, r.accounts, r.configuratie]).toEqual([
      false,
      true,
      true,
      true,
    ]);
  });

  it('manager: alles', () => {
    const r = rechtenVoor(['manager']);
    expect(Object.values(r).every(Boolean)).toBe(true);
  });
});
