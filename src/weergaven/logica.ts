// Logica van de overzichten, los van React. Doelbinding (SPEC §1): neutrale woorden,
// geen beoordeling.

export type Zone = 'ruimte' | 'vol' | 'boven_capaciteit';

export const ZONENAAM: Record<Zone, string> = {
  ruimte: 'Ruimte',
  vol: 'Vol',
  boven_capaciteit: 'Boven capaciteit',
};

export function zoneLabel(zone: string | null | undefined): string {
  if (zone === 'ruimte' || zone === 'vol' || zone === 'boven_capaciteit') return ZONENAAM[zone];
  return 'Geen inzetbare uren';
}

export interface TeamRij {
  medewerker_id: string;
  naam: string;
  contracturen_per_week: number | null;
  inzetbaar: number;
  gepland: number;
  ruimte: number;
  belastingsgraad: number | null;
  zone: string | null;
}

export type TeamSortering =
  'naam' | 'contracturen' | 'inzetbaar' | 'gepland' | 'ruimte' | 'belastingsgraad';

/** Sorteert het teamoverzicht; standaard op ruimte, van veel naar weinig. */
export function sorteerTeam(
  rijen: TeamRij[],
  op: TeamSortering = 'ruimte',
  oplopend = false,
): TeamRij[] {
  const waarde = (r: TeamRij): number | string => {
    switch (op) {
      case 'naam':
        return r.naam;
      case 'contracturen':
        return r.contracturen_per_week ?? -1;
      case 'inzetbaar':
        return r.inzetbaar;
      case 'gepland':
        return r.gepland;
      case 'ruimte':
        return r.ruimte;
      case 'belastingsgraad':
        return r.belastingsgraad ?? -1;
    }
  };
  return [...rijen].sort((a, b) => {
    const x = waarde(a);
    const y = waarde(b);
    const verschil =
      typeof x === 'number' && typeof y === 'number'
        ? x - y
        : String(x).localeCompare(String(y), 'nl');
    return (oplopend ? verschil : -verschil) || a.naam.localeCompare(b.naam, 'nl');
  });
}

/** Alleen medewerkers met inzetbare uren in het schooljaar (dus met een contract). */
export function metContract<T extends { inzetbaar: number; contracturen_per_week: number | null }>(
  rijen: T[],
): T[] {
  return rijen.filter((r) => r.inzetbaar > 0 || (r.contracturen_per_week ?? 0) > 0);
}

export interface VergelijkRij {
  werkpakket_id: string | null;
  werkpakket_naam: string | null;
  categorie: string | null;
  gepland: number;
  gepland_tot_peildatum: number;
  gerealiseerd: number;
  gerealiseerd_tot_peildatum: number;
}

export interface Totaal {
  sleutel: string;
  naam: string;
  gepland: number;
  geplandTot: number;
  gerealiseerd: number;
  gerealiseerdTot: number;
}

export const CATEGORIEEN = ['uitvoering', 'voorbereiding_afronding', 'relatiebeheer'] as const;
export const CATEGORIENAAM: Record<string, string> = {
  uitvoering: 'Uitvoering',
  voorbereiding_afronding: 'Voorbereiding en afronding',
  relatiebeheer: 'Relatiebeheer',
};

function optellen(
  rijen: VergelijkRij[],
  sleutel: (r: VergelijkRij) => string,
  naam: (r: VergelijkRij) => string,
) {
  const m = new Map<string, Totaal>();
  for (const r of rijen) {
    const k = sleutel(r);
    const t = m.get(k) ?? {
      sleutel: k,
      naam: naam(r),
      gepland: 0,
      geplandTot: 0,
      gerealiseerd: 0,
      gerealiseerdTot: 0,
    };
    t.gepland += r.gepland;
    t.geplandTot += r.gepland_tot_peildatum;
    t.gerealiseerd += r.gerealiseerd;
    t.gerealiseerdTot += r.gerealiseerd_tot_peildatum;
    m.set(k, t);
  }
  return m;
}

/** Per categorie (alle drie altijd zichtbaar), plus "zonder categorie" als die voorkomt. */
export function perCategorie(rijen: VergelijkRij[]): Totaal[] {
  const m = optellen(
    rijen,
    (r) => r.categorie ?? '',
    (r) => (r.categorie ? (CATEGORIENAAM[r.categorie] ?? r.categorie) : 'Zonder categorie'),
  );
  const uit = CATEGORIEEN.map(
    (c) =>
      m.get(c) ?? {
        sleutel: c,
        naam: CATEGORIENAAM[c] ?? c,
        gepland: 0,
        geplandTot: 0,
        gerealiseerd: 0,
        gerealiseerdTot: 0,
      },
  );
  const zonder = m.get('');
  return zonder ? [...uit, zonder] : uit;
}

/** Per gekoppeld werkpakket (alle categorieën samen). */
export function perWerkpakket(rijen: VergelijkRij[]): Totaal[] {
  return [
    ...optellen(
      rijen.filter((r) => r.werkpakket_id !== null),
      (r) => r.werkpakket_id ?? '',
      (r) => r.werkpakket_naam ?? 'Werkpakket',
    ).values(),
  ].sort((a, b) => a.naam.localeCompare(b.naam, 'nl'));
}

/** Uren op MATT-projecten zonder werkpakket (alleen gerealiseerd). */
export function nietGekoppeld(rijen: VergelijkRij[]): Totaal {
  const t = optellen(
    rijen.filter((r) => r.werkpakket_id === null),
    () => 'los',
    () => 'Niet gekoppeld',
  ).get('los');
  return (
    t ?? {
      sleutel: 'los',
      naam: 'Niet gekoppeld',
      gepland: 0,
      geplandTot: 0,
      gerealiseerd: 0,
      gerealiseerdTot: 0,
    }
  );
}

/** Neutraal verschil met teken, bijv. "+2,5" of "−1,0". */
export function verschil(gerealiseerd: number, gepland: number): string {
  const v = Math.round((gerealiseerd - gepland) * 10) / 10;
  const tekst = Math.abs(v).toLocaleString('nl-NL', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  if (v > 0) return `+${tekst}`;
  if (v < 0) return `−${tekst}`;
  return tekst;
}
