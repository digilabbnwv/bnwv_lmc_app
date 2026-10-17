import { describe, expect, it } from 'vitest';
import {
  metContract,
  nietGekoppeld,
  perCategorie,
  perWerkpakket,
  sorteerTeam,
  verschil,
  asSchaal,
  filterTeam,
  teamTotaal,
  zonegrenzen,
  zoneLabel,
  type TeamRij,
  type VergelijkRij,
} from './logica';

describe('zoneLabel', () => {
  it('neutrale woorden; zonder zone een uitleg', () => {
    expect(zoneLabel('ruimte')).toBe('Ruimte');
    expect(zoneLabel('vol')).toBe('Vol');
    expect(zoneLabel('boven_capaciteit')).toBe('Boven capaciteit');
    expect(zoneLabel(null)).toBe('Geen inzetbare uren');
  });
});

const rij = (naam: string, ruimte: number, over: Partial<TeamRij> = {}): TeamRij => ({
  medewerker_id: naam,
  naam,
  contracturen_per_week: 24,
  inzetbaar: 900,
  gepland: 900 - ruimte,
  ruimte,
  belastingsgraad: (900 - ruimte) / 900,
  zone: 'ruimte',
  ...over,
});

describe('teamoverzicht', () => {
  it('standaard gesorteerd op ruimte, van veel naar weinig ("wie heeft ruimte?")', () => {
    const r = sorteerTeam([rij('Kees', 10), rij('Sanne', 200), rij('Lotte', -50)]);
    expect(r.map((x) => x.naam)).toEqual(['Sanne', 'Kees', 'Lotte']);
  });

  it('op naam oplopend; gelijke waarden op naam', () => {
    expect(sorteerTeam([rij('Sanne', 1), rij('Kees', 1)], 'naam', true).map((x) => x.naam)).toEqual(
      ['Kees', 'Sanne'],
    );
    expect(sorteerTeam([rij('Sanne', 5), rij('Kees', 5)]).map((x) => x.naam)).toEqual([
      'Kees',
      'Sanne',
    ]);
  });

  it('alleen medewerkers met een contract in het schooljaar', () => {
    const zonder = rij('Manager', 0, { inzetbaar: 0, contracturen_per_week: null });
    expect(metContract([rij('Kees', 10), zonder]).map((x) => x.naam)).toEqual(['Kees']);
  });
});

const v = (over: Partial<VergelijkRij>): VergelijkRij => ({
  werkpakket_id: 'w1',
  werkpakket_naam: 'Kinderboekenweek',
  categorie: 'uitvoering',
  gepland: 0,
  gepland_tot_peildatum: 0,
  gerealiseerd: 0,
  gerealiseerd_tot_peildatum: 0,
  ...over,
});

describe('gepland versus gerealiseerd', () => {
  const rijen = [
    v({ categorie: 'uitvoering', gepland: 10, gepland_tot_peildatum: 5, gerealiseerd: 3 }),
    v({ categorie: 'voorbereiding_afronding', gepland: 6, gerealiseerd: 1.5 }),
    v({ categorie: 'relatiebeheer', gerealiseerd: 0.5 }),
    v({ werkpakket_id: null, werkpakket_naam: null, categorie: 'uitvoering', gerealiseerd: 2 }),
    v({ werkpakket_id: 'w2', werkpakket_naam: 'Digilab', categorie: null, gerealiseerd: 1 }),
  ];

  it('per categorie: altijd de drie categorieën, plus "zonder categorie" als die voorkomt', () => {
    const c = perCategorie(rijen);
    expect(c.map((x) => x.naam)).toEqual([
      'Uitvoering',
      'Voorbereiding en afronding',
      'Relatiebeheer',
      'Zonder categorie',
    ]);
    expect(c[0]).toMatchObject({ gepland: 10, geplandTot: 5, gerealiseerd: 5 });
    expect(c[2]).toMatchObject({ gepland: 0, gerealiseerd: 0.5 });
    expect(perCategorie([]).map((x) => x.gepland)).toEqual([0, 0, 0]);
  });

  it('per werkpakket alleen gekoppelde werkpakketten, op naam', () => {
    const w = perWerkpakket(rijen);
    expect(w.map((x) => x.naam)).toEqual(['Digilab', 'Kinderboekenweek']);
    expect(w[1]).toMatchObject({ gepland: 16, gerealiseerd: 5 });
  });

  it('niet-gekoppelde uren apart', () => {
    expect(nietGekoppeld(rijen).gerealiseerd).toBe(2);
    expect(nietGekoppeld([]).gerealiseerd).toBe(0);
  });

  it('verschil met teken, zonder oordeel', () => {
    expect(verschil(12.5, 10)).toBe('+2,5');
    expect(verschil(8, 10)).toBe('−2,0');
    expect(verschil(10, 10)).toBe('0,0');
  });
});

describe('zonegrenzen', () => {
  const instellingen = [
    { sleutel: 'grens_vol', waarde: '85', ingangsdatum: '2020-01-01' },
    { sleutel: 'grens_vol', waarde: '80', ingangsdatum: '2027-01-01' },
    { sleutel: 'grens_boven_capaciteit', waarde: '100', ingangsdatum: '2020-01-01' },
    { sleutel: 'overhead_percentage', waarde: '15', ingangsdatum: '2020-01-01' },
  ];

  it('neemt de laatste waarde op of vóór de datum', () => {
    expect(zonegrenzen(instellingen, '2026-08-01')).toEqual({ vol: 85, boven: 100 });
    expect(zonegrenzen(instellingen, '2027-01-01')).toEqual({ vol: 80, boven: 100 });
  });

  it('null als een grens ontbreekt', () => {
    expect(zonegrenzen(instellingen.slice(0, 2), '2026-08-01')).toBeNull();
    expect(zonegrenzen(instellingen, '2019-01-01')).toBeNull();
  });
});

describe('filterTeam en teamTotaal', () => {
  const rij = (naam: string, zone: string | null, gepland: number): TeamRij => ({
    medewerker_id: naam,
    naam,
    contracturen_per_week: 24,
    inzetbaar: 100,
    gepland,
    ruimte: 100 - gepland,
    belastingsgraad: gepland / 100,
    zone,
  });
  const team = [
    rij('Lotte Visser', 'ruimte', 50),
    rij('Daan de Boer', 'vol', 90),
    rij('Eva Smit', null, 0),
  ];

  it('zoekt op naam, hoofdletterongevoelig', () => {
    expect(filterTeam(team, 'BOER', 'alle').map((r) => r.naam)).toEqual(['Daan de Boer']);
  });

  it('filtert op zone, ook "geen inzetbare uren"', () => {
    expect(filterTeam(team, '', 'vol').map((r) => r.naam)).toEqual(['Daan de Boer']);
    expect(filterTeam(team, '', 'geen').map((r) => r.naam)).toEqual(['Eva Smit']);
    expect(filterTeam(team, '', 'alle')).toHaveLength(3);
  });

  it('telt de getoonde rijen op', () => {
    expect(teamTotaal(team)).toEqual({
      aantal: 3,
      contracturen: 72,
      inzetbaar: 300,
      gepland: 140,
      ruimte: 160,
    });
    expect(teamTotaal([]).aantal).toBe(0);
  });
});

describe('asSchaal', () => {
  it('ronde bovengrens met hooguit drie stappen', () => {
    expect(asSchaal(104)).toEqual({ max: 150, stappen: [0, 50, 100, 150] });
    expect(asSchaal(90)).toEqual({ max: 100, stappen: [0, 50, 100] });
    expect(asSchaal(7.3)).toEqual({ max: 7.5, stappen: [0, 2.5, 5, 7.5] });
  });

  it('nul of geen gegevens: een lege as', () => {
    expect(asSchaal(0)).toEqual({ max: 1, stappen: [0] });
  });

  it('de bovengrens is nooit lager dan de hoogste waarde', () => {
    for (const h of [1, 3.3, 12, 55, 99.9, 101, 160, 1234]) {
      expect(asSchaal(h).max).toBeGreaterThanOrEqual(h);
    }
  });
});
