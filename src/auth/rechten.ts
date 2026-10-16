// Welke onderdelen de frontend toont per rol (SPEC §6). De frontend verbergt alleen;
// de database beslist (RLS).
import type { Rol } from './AuthContext';

export interface Rechten {
  /** Configuratie: schooljaren, staffel, factoren, percentages, vakanties. */
  configuratie: boolean;
  /** Medewerkers, contracten, aliassen, beschikbaarheid. */
  medewerkers: boolean;
  /** Scholen, activiteiten, projecten en toewijzingen beheren. */
  werkBeheren: boolean;
  /** Scholen, activiteiten, projecten en toewijzingen inzien. */
  werkInzien: boolean;
  /** MATT-projecten koppelen (onderdeel van de import). */
  mattProjecten: boolean;
  /** Accounts aanmaken en resetten. */
  accounts: boolean;
  /** Er is minstens één beheeronderdeel. */
  beheer: boolean;
}

export function rechtenVoor(rollen: readonly Rol[]): Rechten {
  const heeft = (...r: Rol[]) => r.some((x) => rollen.includes(x));
  const cmb = heeft('coordinator', 'manager', 'beheerder');
  return {
    configuratie: cmb,
    medewerkers: cmb,
    werkBeheren: heeft('coordinator', 'manager'),
    werkInzien: cmb,
    mattProjecten: cmb,
    accounts: heeft('manager', 'beheerder'),
    beheer: cmb,
  };
}
