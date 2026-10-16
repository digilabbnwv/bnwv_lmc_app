import { describe, expect, it } from 'vitest';
import {
  controleerBestand,
  controleerPeriode,
  MAX_BYTES,
  samenvatting,
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
