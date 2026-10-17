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

export interface Zonegrenzen {
  /** Percentage vanaf waar de zone "vol" is (seed: 85). */
  vol: number;
  /** Percentage waarboven de zone "boven capaciteit" is (seed: 100). */
  boven: number;
}

/**
 * De grenzen die gelden op `datum`: per sleutel de waarde met de laatste ingangsdatum op of
 * vóór die datum (zoals private.instelling_op in de database). Null als er een ontbreekt.
 */
export function zonegrenzen(
  instellingen: readonly { sleutel: string; waarde: string; ingangsdatum: string }[],
  datum: string,
): Zonegrenzen | null {
  const op = (sleutel: string) => {
    const geldig = instellingen
      .filter((i) => i.sleutel === sleutel && i.ingangsdatum <= datum)
      .sort((a, b) => b.ingangsdatum.localeCompare(a.ingangsdatum))[0];
    const getal = geldig ? Number(geldig.waarde) : NaN;
    return Number.isFinite(getal) ? getal : null;
  };
  const vol = op('grens_vol');
  const boven = op('grens_boven_capaciteit');
  return vol === null || boven === null ? null : { vol, boven };
}

export type ZoneFilter = 'alle' | Zone | 'geen';

/** Zoeken op naam (hoofdletterongevoelig) en filteren op zone. */
export function filterTeam(rijen: TeamRij[], zoek: string, zone: ZoneFilter): TeamRij[] {
  const term = zoek.trim().toLocaleLowerCase('nl');
  return rijen.filter(
    (r) =>
      (!term || r.naam.toLocaleLowerCase('nl').includes(term)) &&
      (zone === 'alle' || (zone === 'geen' ? r.zone === null : r.zone === zone)),
  );
}

export interface TeamTotaal {
  aantal: number;
  contracturen: number;
  inzetbaar: number;
  gepland: number;
  ruimte: number;
}

/** Totalen voor capaciteitsplanning op teamniveau (over de getoonde rijen). */
export function teamTotaal(rijen: TeamRij[]): TeamTotaal {
  return rijen.reduce<TeamTotaal>(
    (t, r) => ({
      aantal: t.aantal + 1,
      contracturen: t.contracturen + (r.contracturen_per_week ?? 0),
      inzetbaar: t.inzetbaar + r.inzetbaar,
      gepland: t.gepland + r.gepland,
      ruimte: t.ruimte + r.ruimte,
    }),
    { aantal: 0, contracturen: 0, inzetbaar: 0, gepland: 0, ruimte: 0 },
  );
}

/**
 * Een ronde bovengrens voor de y-as en de tussenstappen (0 en hooguit drie stappen erboven),
 * bijvoorbeeld 0, 50, 100, 150 bij een hoogste waarde van 104.
 */
export function asSchaal(hoogste: number): { max: number; stappen: number[] } {
  if (!(hoogste > 0)) return { max: 1, stappen: [0] };
  const ruw = hoogste / 3;
  const orde = 10 ** Math.floor(Math.log10(ruw));
  const stap = ([1, 2, 2.5, 5, 10].find((f) => f * orde >= ruw) ?? 10) * orde;
  const max = stap * Math.ceil(hoogste / stap);
  const stappen: number[] = [];
  for (let s = 0; s <= max + stap / 2; s += stap) stappen.push(Math.round(s * 100) / 100);
  return { max, stappen };
}
