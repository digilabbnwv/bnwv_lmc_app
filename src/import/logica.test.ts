import { describe, expect, it } from 'vitest';
import {
  controleerBestand,
  controleerPeriode,
  MAX_BYTES,
  samenvatting,
  actieNodig,
  bestandsgrootte,
  huidigeStap,
  schooljaarTotGisteren,
  vorigeMaand,
  type Voorvertoning,
} from './logica';

describe('controleerBestand', () => {
  it('vraagt een XML-bestand van maximaal 10 MB', () => {
    expect(controleerBestand(null)).toMatch(/Kies/);
    expect(controleerBestand({ name: 'export.xlsx', size: 10 })).toMatch(/XML/);
    expect(controleerBestand({ name: 'export.XML', size: 0 })).toMatch(/leeg/);
    expect(controleerBestand({ name: 'export.xml', size: MAX_BYTES + 1 })).toMatch(/10 MB/);
    expect(controleerBestand({ name: 'export.xml', size: MAX_BYTES })).toBeNull();
  });
});

describe('controleerPeriode', () => {
  it('vraagt een geldige periode', () => {
    expect(controleerPeriode('', '2026-03-31')).toMatch(/periode/);
    expect(controleerPeriode('2026-03-31', '2026-01-01')).toMatch(/voor de begindatum/);
    expect(controleerPeriode('2026-01-01', '2026-03-31')).toBeNull();
  });
});

describe('samenvatting', () => {
  const basis: Voorvertoning = {
    import_id: 'x',
    bestand: { regels: 79, projecten: 14, eindtotaal: { uren: 171.75 } },
    totaal: { aantal: 79, uren: 171.75 },
    opgeslagen: { aantal: 78, uren: 170 },
    medewerkers: [
      { medewerker_id: 'a', aantal: 40, uren: 90 },
      { medewerker_id: 'b', aantal: 38, uren: 80 },
    ],
    niet_gematcht: [{ naam: 'Testpersoon Onbekend', aantal: 1, uren: 1.75 }],
    niet_gematcht_aantal: 1,
    niet_gekoppelde_projecten: [{ projectnummer: '999', naam: 'Onbekend testproject', uren: 12 }],
    onbekende_artikelcodes: [],
  };

  it('noemt aantallen, niet-gematchte boekingen en niet-gekoppelde projecten', () => {
    const z = samenvatting(basis);
    expect(z[0]).toMatch(/79 boekingen in 14 projecten/);
    expect(z[1]).toMatch(/78 boekingen .* 2 medewerkers/);
    expect(z.join(' ')).toMatch(/1 boekingen horen bij een naam zonder alias/);
    expect(z.join(' ')).toMatch(/1 MATT-projecten/);
  });

  it('waarschuwt alleen bij onbekende artikelcodes als die er zijn', () => {
    expect(samenvatting(basis).join(' ')).not.toMatch(/artikelcodes/);
    expect(
      samenvatting({ ...basis, onbekende_artikelcodes: [{ artikelcode: '99', aantal: 2 }] }).join(
        ' ',
      ),
    ).toMatch(/artikelcodes/);
  });

  it('noemt geen namen van personen', () => {
    expect(samenvatting(basis).join(' ')).not.toMatch(/Testpersoon/);
  });
});

describe('stappen en hulpfuncties (UI-4)', () => {
  const leeg: Voorvertoning = {
    import_id: 'x',
    bestand: { regels: 0, projecten: 0, eindtotaal: { uren: 0 } },
    totaal: { aantal: 0, uren: 0 },
    opgeslagen: { aantal: 0, uren: 0 },
    medewerkers: [],
    niet_gematcht: [],
    niet_gematcht_aantal: 0,
    niet_gekoppelde_projecten: [],
    onbekende_artikelcodes: [],
  };

  it('huidigeStap', () => {
    expect(huidigeStap(null, false)).toBe(1);
    expect(huidigeStap(leeg, false)).toBe(2);
    expect(huidigeStap(null, true)).toBe(3);
  });

  it('actieNodig bij namen zonder alias of onbekende artikelcodes, niet bij projecten', () => {
    expect(actieNodig(leeg)).toBe(false);
    expect(actieNodig({ ...leeg, niet_gematcht: [{ naam: 'X', aantal: 1, uren: 1 }] })).toBe(true);
    expect(actieNodig({ ...leeg, onbekende_artikelcodes: [{ artikelcode: 'A', aantal: 1 }] })).toBe(
      true,
    );
    expect(
      actieNodig({
        ...leeg,
        niet_gekoppelde_projecten: [{ projectnummer: '999', naam: null, uren: 1 }],
      }),
    ).toBe(false);
  });

  it('vorigeMaand, ook over de jaargrens', () => {
    expect(vorigeMaand(new Date(2026, 9, 17))).toEqual({ van: '2026-09-01', tot: '2026-09-30' });
    expect(vorigeMaand(new Date(2027, 0, 5))).toEqual({ van: '2026-12-01', tot: '2026-12-31' });
    expect(vorigeMaand(new Date(2028, 2, 1))).toEqual({ van: '2028-02-01', tot: '2028-02-29' });
  });

  it('schooljaarTotGisteren', () => {
    const sj = { startdatum: '2026-08-01', einddatum: '2027-07-31' };
    expect(schooljaarTotGisteren(sj, new Date(2026, 9, 17))).toEqual({
      van: '2026-08-01',
      tot: '2026-10-16',
    });
    expect(schooljaarTotGisteren(sj, new Date(2027, 8, 1))?.tot).toBe('2027-07-31');
    expect(schooljaarTotGisteren(sj, new Date(2026, 7, 1))).toBeNull();
  });

  it('bestandsgrootte', () => {
    expect(bestandsgrootte(350 * 1024)).toBe('350 kB');
    expect(bestandsgrootte(1.25 * 1024 * 1024)).toBe('1,3 MB');
    expect(bestandsgrootte(10)).toBe('1 kB');
  });
});
