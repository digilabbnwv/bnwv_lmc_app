import { useQuery } from '@tanstack/react-query';
import { ophalen, useSchooljaren } from '../beheer/data';
import { supabase } from '../lib/supabase';
import { zonegrenzen, type VergelijkRij, type Zonegrenzen } from './logica';

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

/** De zonegrenzen die gelden aan het begin van het schooljaar (zoals de database rekent). */
export function useZonegrenzen(schooljaarId: string | null): Zonegrenzen | null {
  const schooljaren = useSchooljaren();
  const instellingen = useQuery({
    queryKey: ['instelling', 'zonegrenzen'],
    queryFn: () =>
      ophalen(
        supabase()
          .from('instelling')
          .select('sleutel, waarde, ingangsdatum')
          .in('sleutel', ['grens_vol', 'grens_boven_capaciteit']),
      ),
  });
  const schooljaar = schooljaren.data?.find((s) => s.id === schooljaarId);
  return schooljaar && instellingen.data
    ? zonegrenzen(instellingen.data, schooljaar.startdatum)
    : null;
}
