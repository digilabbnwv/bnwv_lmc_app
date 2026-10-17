import { describe, expect, it } from 'vitest';
import { rechtenVoor } from '../auth/rechten';
import { documentTitel, paginaTitel, zichtbareGroepen } from './navigatie';

const titels = (rol: Parameters<typeof rechtenVoor>[0]) =>
  zichtbareGroepen(rechtenVoor(rol)).flatMap((g) => g.items.map((i) => i.titel));

describe('hoofdmenu per rol', () => {
  it('een lmc ziet geen team, beheer, import of accounts', () => {
    expect(titels(['lmc'])).toEqual([
      'Mijn belasting',
      'Gepland en gerealiseerd',
      'Beveiliging',
      'Over deze app',
    ]);
    expect(zichtbareGroepen(rechtenVoor(['lmc'])).map((g) => g.titel)).toEqual([
      'Overzichten',
      'Jouw account',
    ]);
  });

  it('een coördinator ziet beheer en import, geen accounts', () => {
    const t = titels(['coordinator']);
    expect(t).toContain('Teamoverzicht');
    expect(t).toContain('Beheer');
    expect(t).toContain('MATT-import');
    expect(t).not.toContain('Accounts');
  });

  it('een manager ziet alles', () => {
    expect(titels(['manager'])).toHaveLength(8);
  });
});

describe('paginatitels', () => {
  it('de startpagina hangt af van de rol', () => {
    expect(paginaTitel('/', rechtenVoor(['lmc']))).toBe('Mijn belasting');
    expect(paginaTitel('/', rechtenVoor(['manager']))).toBe('Teamoverzicht');
  });

  it('onderliggende paden krijgen de titel van het menu-item', () => {
    const r = rechtenVoor(['manager']);
    expect(paginaTitel('/beheer', r)).toBe('Beheer');
    expect(paginaTitel('/beheer/scholen', r)).toBe('Scholen');
    expect(paginaTitel('/beheer/medewerkers/abc', r)).toBe('Medewerkers');
    expect(paginaTitel('/beheer/onbekend', r)).toBe('Beheer');
    expect(paginaTitel('/gepland-gerealiseerd/abc', r)).toBe('Gepland en gerealiseerd');
    expect(paginaTitel('/beheerx', r)).toBe('Pagina niet gevonden');
  });

  it('geen titel voor een pagina zonder recht', () => {
    expect(paginaTitel('/accounts', rechtenVoor(['lmc']))).toBe('Pagina niet gevonden');
  });

  it('document.title bevat de app-naam', () => {
    expect(documentTitel('Beheer')).toBe('Beheer · LMC-capaciteit');
  });
});
