import type { ReactNode } from 'react';
import type { z } from 'zod';
import type { Formulierwaarden } from './schema';

export type VeldType = 'tekst' | 'getal' | 'datum' | 'keuze' | 'vinkje' | 'tekstvak' | 'datumlijst';

export interface Optie {
  waarde: string;
  label: string;
}

export interface Veld {
  naam: string;
  label: string;
  type: VeldType;
  opties?: Optie[];
  /** Lege keuze tonen (bijv. "niet gekoppeld"). */
  legeOptie?: string;
  verplicht?: boolean;
  hulp?: string;
  /** Alleen-lezen, eventueel afhankelijk van de huidige waarden of het bestaande record. */
  alleenLezen?: boolean | ((waarden: Formulierwaarden, nieuw: boolean) => boolean);
  /** Tonen afhankelijk van de huidige waarden. */
  zichtbaar?: (waarden: Formulierwaarden) => boolean;
  stap?: string;
}

export interface Kolom<R> {
  kop: string;
  waarde: (rij: R) => ReactNode;
  /** Waarde om op te sorteren en te zoeken; zonder deze waarde kan de kolom niet sorteren. */
  sorteer?: (rij: R) => string | number;
  numeriek?: boolean;
}

export interface BeheerDefinitie<R, U> {
  /** Meervoud, voor de koptekst ("Feestdagen"). */
  titel: string;
  /** Enkelvoud, voor knoppen en het formulier ("feestdag"). */
  enkelvoud: string;
  omschrijving?: ReactNode;
  queryKey: readonly unknown[];
  laad: () => Promise<R[]>;
  sleutel: (rij: R) => string;
  /** Naam van een rij, voor meldingen en de bevestiging bij verwijderen. */
  rijNaam: (rij: R) => string;
  kolommen: Kolom<R>[];
  velden: Veld[];
  schema: z.ZodType<U>;
  leeg: () => Formulierwaarden;
  naarFormulier: (rij: R) => Formulierwaarden;
  opslaan: (waarden: U, bestaand: R | null) => Promise<void>;
  verwijder?: (rij: R) => Promise<void>;
  /** false = geen knop "toevoegen" (bijv. bij de gegevens van één medewerker). */
  kanToevoegen?: boolean;
  /** Extra querykeys die na opslaan opnieuw geladen moeten worden. */
  ookVernieuwen?: readonly (readonly unknown[])[];
}
