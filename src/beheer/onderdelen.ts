// Beheeronderdelen: naam, groep, korte uitleg en rechten (SPEC §6). Eén bron voor het
// beheeroverzicht, de routes, het kruimelpad en de paginatitel.
import type { Rechten } from '../auth/rechten';

export type BeheerGroep = 'Configuratie' | 'Medewerkers' | 'Werk' | 'Toewijzingen';

export interface BeheerOnderdeel {
  pad: string;
  naam: string;
  groep: BeheerGroep;
  omschrijving: string;
  zichtbaar: (r: Rechten) => boolean;
  magBewerken: (r: Rechten) => boolean;
}

const configuratie = (r: Rechten) => r.configuratie;
const werkInzien = (r: Rechten) => r.werkInzien;
const werkBeheren = (r: Rechten) => r.werkBeheren;

export const GROEPEN: readonly BeheerGroep[] = [
  'Configuratie',
  'Medewerkers',
  'Werk',
  'Toewijzingen',
];

export const ONDERDELEN: readonly BeheerOnderdeel[] = [
  {
    pad: 'schooljaren',
    naam: 'Schooljaren',
    groep: 'Configuratie',
    omschrijving: 'Begin- en einddatum van elk schooljaar.',
    zichtbaar: configuratie,
    magBewerken: configuratie,
  },
  {
    pad: 'schoolvakanties',
    naam: 'Schoolvakanties',
    groep: 'Configuratie',
    omschrijving: 'Vakanties per schooljaar; die dagen tellen niet als werkdag.',
    zichtbaar: configuratie,
    magBewerken: configuratie,
  },
  {
    pad: 'feestdagen',
    naam: 'Feestdagen',
    groep: 'Configuratie',
    omschrijving: 'Vrije dagen buiten de schoolvakanties.',
    zichtbaar: configuratie,
    magBewerken: configuratie,
  },
  {
    pad: 'staffel',
    naam: 'Staffel',
    groep: 'Configuratie',
    omschrijving: 'Uren per school op basis van schooltype en aantal leerlingen.',
    zichtbaar: configuratie,
    magBewerken: configuratie,
  },
  {
    pad: 'opslagfactoren',
    naam: 'Opslagfactoren',
    groep: 'Configuratie',
    omschrijving: 'Factor voor voorbereiding bovenop de staffeluren, per schooltype.',
    zichtbaar: configuratie,
    magBewerken: configuratie,
  },
  {
    pad: 'instellingen',
    naam: 'Instellingen',
    groep: 'Configuratie',
    omschrijving: 'Overheadpercentage, grenzen van de signaalzones en het e-maildomein.',
    zichtbaar: configuratie,
    magBewerken: configuratie,
  },
  {
    pad: 'artikelcodes',
    naam: 'MATT-artikelcodes',
    groep: 'Configuratie',
    omschrijving: 'Welke MATT-artikelcode bij welke categorie uren hoort.',
    zichtbaar: configuratie,
    magBewerken: configuratie,
  },
  {
    pad: 'medewerkers',
    naam: 'Medewerkers',
    groep: 'Medewerkers',
    omschrijving: 'Medewerkers met contracten, aliassen en beschikbaarheid.',
    zichtbaar: (r) => r.medewerkers,
    magBewerken: (r) => r.medewerkers,
  },
  {
    pad: 'scholen',
    naam: 'Scholen',
    groep: 'Werk',
    omschrijving: 'Scholen met schooltype en vestiging.',
    zichtbaar: werkInzien,
    magBewerken: werkBeheren,
  },
  {
    pad: 'leerlingen',
    naam: 'Leerlingen per schooljaar',
    groep: 'Werk',
    omschrijving: 'Aantal leerlingen per school; hieruit volgen de staffeluren.',
    zichtbaar: werkInzien,
    magBewerken: werkBeheren,
  },
  {
    pad: 'activiteittypes',
    naam: 'Activiteittypes',
    groep: 'Werk',
    omschrijving: 'Soorten activiteiten met normuren per keer.',
    zichtbaar: werkInzien,
    magBewerken: werkBeheren,
  },
  {
    pad: 'activiteiten',
    naam: 'Activiteiten',
    groep: 'Werk',
    omschrijving: 'Activiteiten als werkpakket, op basis van een activiteittype.',
    zichtbaar: werkInzien,
    magBewerken: werkBeheren,
  },
  {
    pad: 'projecten',
    naam: 'Projecten',
    groep: 'Werk',
    omschrijving: 'Projecten als werkpakket.',
    zichtbaar: werkInzien,
    magBewerken: werkBeheren,
  },
  {
    pad: 'matt-projecten',
    naam: 'MATT-projecten',
    groep: 'Werk',
    omschrijving: 'Projectnummers uit MATT koppelen aan een werkpakket of negeren.',
    zichtbaar: (r) => r.mattProjecten,
    magBewerken: (r) => r.mattProjecten,
  },
  {
    pad: 'toewijzingen',
    naam: 'Toewijzingen',
    groep: 'Toewijzingen',
    omschrijving: 'Wie welk werkpakket doet, met hoeveel uren en welke verdeling.',
    zichtbaar: werkInzien,
    magBewerken: werkBeheren,
  },
];

/** Het onderdeel bij een pad onder /beheer, zoals "scholen" of "medewerkers/123". */
export function onderdeelBij(subpad: string, r: Rechten): BeheerOnderdeel | undefined {
  const eerste = subpad.split('/')[0] ?? '';
  return ONDERDELEN.find((o) => o.pad === eerste && o.zichtbaar(r));
}
