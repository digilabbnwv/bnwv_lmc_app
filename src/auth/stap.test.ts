import { describe, expect, it } from 'vitest';
import { bepaalStap, type AuthToestand } from './stap';

const basis: AuthToestand = {
  geladen: true,
  sessie: true,
  aal: 'aal2',
  heeftGeverifieerdeFactor: true,
  moetWachtwoordWijzigen: false,
  heeftToegangNaMfa: true,
};

describe('bepaalStap', () => {
  it('laden zolang de toestand niet bekend is', () => {
    expect(bepaalStap({ ...basis, geladen: false })).toBe('laden');
  });

  it('inloggen zonder sessie', () => {
    expect(bepaalStap({ ...basis, sessie: false, aal: null })).toBe('inloggen');
  });

  it('eerste keer: wachtwoord wijzigen vóór TOTP koppelen', () => {
    const eerste = {
      ...basis,
      aal: 'aal1' as const,
      heeftGeverifieerdeFactor: false,
      moetWachtwoordWijzigen: true,
    };
    expect(bepaalStap(eerste)).toBe('wachtwoord');
    expect(bepaalStap({ ...eerste, moetWachtwoordWijzigen: false })).toBe('totp_koppelen');
  });

  it('met een gekoppeld toestel op aal1: eerst de code', () => {
    expect(bepaalStap({ ...basis, aal: 'aal1' })).toBe('totp_code');
    expect(bepaalStap({ ...basis, aal: 'aal1', moetWachtwoordWijzigen: true })).toBe('totp_code');
  });

  it('op aal2 maar moet nog wachtwoord wijzigen', () => {
    expect(bepaalStap({ ...basis, moetWachtwoordWijzigen: true })).toBe('wachtwoord');
  });

  it('nooit de app zonder aal2', () => {
    for (const aal of ['aal1', null] as const) {
      for (const factor of [true, false]) {
        expect(bepaalStap({ ...basis, aal, heeftGeverifieerdeFactor: factor })).not.toBe('app');
      }
    }
  });

  it('geen toegang zonder rol of actieve medewerker', () => {
    expect(bepaalStap({ ...basis, heeftToegangNaMfa: false })).toBe('geen_toegang');
  });

  it('de app alleen als alles in orde is', () => {
    expect(bepaalStap(basis)).toBe('app');
  });
});
