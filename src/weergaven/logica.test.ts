import { describe, expect, it } from 'vitest';
import {
  metContract,
  nietGekoppeld,
  perCategorie,
  perWerkpakket,
  sorteerTeam,
  verschil,
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
