import { ophalen } from '../beheer/data';
import { supabase } from '../lib/supabase';
import type { VergelijkRij } from './logica';

/**
 * Gepland versus gerealiseerd van één medewerker in een schooljaar. werkpakket_id en
 * categorie kunnen leeg zijn (niet gekoppeld, zonder categorie); de gegenereerde types
 * van een functie weten dat niet, daarom hier expliciet.
 */
export async function haalVergelijking(
  medewerkerId: string,
  schooljaarId: string,
): Promise<VergelijkRij[]> {
  const rijen = await ophalen(
    supabase().rpc('gepland_vs_gerealiseerd', {
      p_medewerker_id: medewerkerId,
      p_schooljaar_id: schooljaarId,
    }),
  );
  // De rijen passen op VergelijkRij; daar zijn werkpakket_id en categorie wel nullable.
  return rijen;
}
