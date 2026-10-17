// Hoofdmenu en paginatitels. Eén bron, zodat menu, document.title en tests overeenkomen.
// De frontend verbergt alleen; de database beslist (RLS).
import type { Rechten } from '../auth/rechten';

export const APP_NAAM = 'LMC-capaciteit';

export interface NavItem {
  pad: string;
  titel: string;
  zichtbaar: (r: Rechten) => boolean;
}

export interface NavGroep {
  titel: string;
  items: NavItem[];
}

const altijd = () => true;

export const GROEPEN: readonly NavGroep[] = [
  {
    titel: 'Overzichten',
    items: [
      { pad: '/mijn-belasting', titel: 'Mijn belasting', zichtbaar: altijd },
      { pad: '/team', titel: 'Teamoverzicht', zichtbaar: (r) => r.werkInzien },
      { pad: '/gepland-gerealiseerd', titel: 'Gepland en gerealiseerd', zichtbaar: altijd },
    ],
  },
  {
    titel: 'Beheer en import',
    items: [
      { pad: '/beheer', titel: 'Beheer', zichtbaar: (r) => r.beheer },
      { pad: '/import', titel: 'MATT-import', zichtbaar: (r) => r.importeren },
      { pad: '/accounts', titel: 'Accounts', zichtbaar: (r) => r.accounts },
    ],
  },
  {
    titel: 'Jouw account',
    items: [
      { pad: '/beveiliging', titel: 'Beveiliging', zichtbaar: altijd },
      { pad: '/over', titel: 'Over deze app', zichtbaar: altijd },
    ],
  },
];

/** De groepen en items die deze gebruiker ziet; lege groepen vallen weg. */
export function zichtbareGroepen(r: Rechten): NavGroep[] {
  return GROEPEN.map((g) => ({ ...g, items: g.items.filter((i) => i.zichtbaar(r)) })).filter(
    (g) => g.items.length > 0,
  );
}

/** Titel van de pagina bij een pad (ook voor onderliggende paden, zoals /beheer/scholen). */
export function paginaTitel(pad: string, r: Rechten): string {
  if (pad === '/') return r.werkInzien ? 'Teamoverzicht' : 'Mijn belasting';
  for (const groep of zichtbareGroepen(r)) {
    for (const item of groep.items) {
      if (pad === item.pad || pad.startsWith(`${item.pad}/`)) return item.titel;
    }
  }
  return 'Pagina niet gevonden';
}

export function documentTitel(pagina: string): string {
  return `${pagina} · ${APP_NAAM}`;
}
