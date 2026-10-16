// Toewijzingen (SPEC §4, §5): wie werkt aan welk werkpakket in een schooljaar, met
// welke uren en welke verdeling. De uren zelf rekent de database (toewijzing_uren).
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { supabase } from '../lib/supabase';
import { formatUren } from '../lib/opmaak';
import { BeheerScherm } from './BeheerScherm';
import {
  BRONNAAM,
  BRONNEN,
  naamVan,
  ophalen,
  opties,
  useMedewerkers,
  useSchooljaren,
  useWerkpakketten,
  VERDELINGEN,
  VERDELINGNAAM,
  type Bron,
  type Verdeling,
  type WerkpakketSoort,
} from './data';
import { SchooljaarKiezer } from './SchooljaarKiezer';
import { v, type Formulierwaarden } from './schema';
import type { BeheerDefinitie } from './types';

/** Toegestane bronnen per soort werkpakket (de database controleert hetzelfde). */
export const BRON_PER_SOORT: Record<WerkpakketSoort, Bron[]> = {
  school: ['staffel', 'handmatig'],
  activiteit: ['norm_x_aantal', 'handmatig'],
  project: ['handmatig'],
};

export interface Toewijzing {
  id: string;
  medewerker_id: string;
  werkpakket_id: string;
  bron: Bron;
  aandeel_percentage: number;
  aantal_keer: number | null;
  gepland_uitvoering: number | null;
  gepland_voorbereiding: number | null;
  gepland_afronding: number | null;
  verdeling: Verdeling;
  looptijd_van: string | null;
  looptijd_tot: string | null;
  toelichting: string | null;
}

/** Schema voor het formulier; soortVan geeft de soort van een werkpakket. */
export function toewijzingSchema(
  soortVan: (werkpakketId: string) => WerkpakketSoort | undefined,
  schooljaar: { startdatum: string; einddatum: string },
) {
  return z
    .object({
      medewerker_id: z.string().min(1, 'Kies een medewerker.'),
      werkpakket_id: z.string().min(1, 'Kies een werkpakket.'),
      bron: v.keuze(BRONNEN),
      aandeel_percentage: v.optioneelGetal({ min: 0.01, max: 100 }),
      aantal_keer: v.optioneelGetal({ min: 1, geheel: true }),
      gepland_uitvoering: v.optioneelGetal({ min: 0 }),
      gepland_voorbereiding: v.optioneelGetal({ min: 0 }),
      gepland_afronding: v.optioneelGetal({ min: 0 }),
      verdeling: v.keuze(VERDELINGEN),
      looptijd_van: v.optioneleDatum(),
      looptijd_tot: v.optioneleDatum(),
      datums: v.datumlijst(),
      toelichting: v.optioneleTekst(1000),
    })
    .superRefine((t, ctx) => {
      const fout = (pad: string, melding: string) => {
        ctx.addIssue({ code: 'custom', path: [pad], message: melding });
      };
      const soort = soortVan(t.werkpakket_id);
      if (soort && !BRON_PER_SOORT[soort].includes(t.bron)) {
        fout('bron', `Bij een ${soort} kan deze bron niet.`);
      }
      if (t.bron === 'norm_x_aantal' && t.aantal_keer === null)
        fout('aantal_keer', 'Vul het aantal keer in.');
      if (t.bron === 'handmatig') {
        if (t.gepland_uitvoering === null) fout('gepland_uitvoering', 'Vul de uren in (0 mag).');
        if (t.gepland_voorbereiding === null)
          fout('gepland_voorbereiding', 'Vul de uren in (0 mag).');
        if (t.gepland_afronding === null) fout('gepland_afronding', 'Vul de uren in (0 mag).');
      }
      if (t.verdeling === 'looptijd') {
        if (t.looptijd_van === null) fout('looptijd_van', 'Vul de begindatum in.');
        if (t.looptijd_tot === null) fout('looptijd_tot', 'Vul de einddatum in.');
        if (t.looptijd_van && t.looptijd_tot) {
          if (t.looptijd_tot < t.looptijd_van)
            fout('looptijd_tot', 'De einddatum ligt niet voor de begindatum.');
          if (t.looptijd_van < schooljaar.startdatum || t.looptijd_tot > schooljaar.einddatum) {
            fout('looptijd_van', 'De looptijd valt binnen het schooljaar.');
          }
        }
      }
      if (t.verdeling === 'op_datum') {
        if (t.datums.length === 0) fout('datums', 'Voeg minstens één datum toe.');
        if (t.datums.some((d) => d < schooljaar.startdatum || d > schooljaar.einddatum)) {
          fout('datums', 'Alle datums vallen binnen het schooljaar.');
        }
      }
    })
    .transform((t) => ({
      ...t,
      // Alleen de velden die bij de bron en verdeling horen; de rest leeg (zoals de database eist).
      aandeel_percentage: t.bron === 'staffel' ? (t.aandeel_percentage ?? 100) : 100,
      aantal_keer: t.bron === 'norm_x_aantal' ? t.aantal_keer : null,
      gepland_uitvoering: t.bron === 'handmatig' ? t.gepland_uitvoering : null,
      gepland_voorbereiding: t.bron === 'handmatig' ? t.gepland_voorbereiding : null,
      gepland_afronding: t.bron === 'handmatig' ? t.gepland_afronding : null,
      looptijd_van: t.verdeling === 'looptijd' ? t.looptijd_van : null,
      looptijd_tot: t.verdeling === 'looptijd' ? t.looptijd_tot : null,
      datums: t.verdeling === 'op_datum' ? t.datums : [],
    }));
}

const getal = (n: number | null) => (n === null ? '' : n.toLocaleString('nl-NL'));
const isBron = (b: Bron) => (w: Formulierwaarden) => w.bron === b;
const isVerdeling = (d: Verdeling) => (w: Formulierwaarden) => w.verdeling === d;

export function Toewijzingen({ magBewerken }: { magBewerken: boolean }) {
  const [schooljaarId, setSchooljaarId] = useState<string | null>(null);
  const [medewerkerFilter, setMedewerkerFilter] = useState('');
  const schooljaren = useSchooljaren();
  const medewerkers = useMedewerkers();
  const werkpakketten = useWerkpakketten();
  const schooljaar = schooljaren.data?.find((s) => s.id === schooljaarId);

  const extra = useQuery({
    queryKey: ['toewijzing_extra', schooljaarId],
    enabled: schooljaarId !== null,
    queryFn: async () => {
      const id = schooljaarId ?? '';
      const [uren, datums, terugval, aandelen] = await Promise.all([
        ophalen(
          supabase()
            .from('toewijzing_uren')
            .select('toewijzing_id, totaal')
            .eq('schooljaar_id', id),
        ),
        ophalen(supabase().from('toewijzing_datum').select('toewijzing_id, datum').order('datum')),
        ophalen(
          supabase()
            .from('toewijzing_dag')
            .select('toewijzing_id')
            .eq('schooljaar_id', id)
            .eq('terugval', true),
        ),
        // Aandelen per school, over alle medewerkers (ook buiten het filter).
        ophalen(
          supabase()
            .from('toewijzing')
            .select('werkpakket_id, aandeel_percentage')
            .eq('schooljaar_id', id)
            .eq('bron', 'staffel'),
        ),
      ]);
      return { uren, datums, terugval, aandelen };
    },
  });

  const definitie = useMemo(() => {
    if (!schooljaar || !medewerkers.data || !werkpakketten.data || !extra.data) return null;
    const medewerker = new Map(medewerkers.data.map((m) => [m.id, m]));
    const pakket = new Map(werkpakketten.data.map((w) => [w.id, w]));
    const totaal = new Map(extra.data.uren.map((u) => [u.toewijzing_id, u.totaal]));
    const datumsVan = new Map<string, string[]>();
    for (const d of extra.data.datums) {
      datumsVan.set(d.toewijzing_id, [...(datumsVan.get(d.toewijzing_id) ?? []), d.datum]);
    }
    const terugval = new Set(extra.data.terugval.map((t) => t.toewijzing_id));
    const schema = toewijzingSchema((id) => pakket.get(id)?.soort, schooljaar);

    const aandeelPerSchool = new Map<string, number>();
    for (const a of extra.data.aandelen) {
      aandeelPerSchool.set(
        a.werkpakket_id,
        (aandeelPerSchool.get(a.werkpakket_id) ?? 0) + a.aandeel_percentage,
      );
    }

    const definitie: BeheerDefinitie<Toewijzing, z.infer<typeof schema>> = {
      titel: `Toewijzingen ${schooljaar.naam}`,
      enkelvoud: 'toewijzing',
      omschrijving:
        'Meerdere medewerkers op hetzelfde werkpakket is normaal. Bij een school verdeelt het aandeel de staffeluren.',
      queryKey: ['toewijzing', schooljaar.id, medewerkerFilter],
      laad: async () => {
        const q = supabase()
          .from('toewijzing')
          .select(
            'id, medewerker_id, werkpakket_id, bron, aandeel_percentage, aantal_keer, gepland_uitvoering, gepland_voorbereiding, gepland_afronding, verdeling, looptijd_van, looptijd_tot, toelichting',
          )
          .eq('schooljaar_id', schooljaar.id);
        return ophalen(medewerkerFilter ? q.eq('medewerker_id', medewerkerFilter) : q);
      },
      sleutel: (r) => r.id,
      rijNaam: (r) => {
        const m = medewerker.get(r.medewerker_id);
        return `${m ? naamVan(m) : 'Medewerker'} – ${pakket.get(r.werkpakket_id)?.naam ?? 'werkpakket'}`;
      },
      kolommen: [
        {
          kop: 'Medewerker',
          waarde: (r) => {
            const m = medewerker.get(r.medewerker_id);
            return m ? naamVan(m) : '';
          },
          sorteer: (r) => medewerker.get(r.medewerker_id)?.achternaam ?? '',
        },
        {
          kop: 'Werkpakket',
          waarde: (r) => pakket.get(r.werkpakket_id)?.naam ?? '',
          sorteer: (r) => pakket.get(r.werkpakket_id)?.naam ?? '',
        },
        { kop: 'Bron', waarde: (r) => BRONNAAM[r.bron], sorteer: (r) => r.bron },
        {
          kop: 'Verdeling',
          waarde: (r) => VERDELINGNAAM[r.verdeling],
          sorteer: (r) => r.verdeling,
        },
        {
          kop: 'Uren',
          waarde: (r) => formatUren(totaal.get(r.id) ?? null),
          sorteer: (r) => totaal.get(r.id) ?? 0,
          numeriek: true,
        },
        {
          kop: 'Opmerking',
          waarde: (r) => {
            const opmerkingen: string[] = [];
            const som = aandeelPerSchool.get(r.werkpakket_id);
            if (r.bron === 'staffel' && som !== undefined && Math.abs(som - 100) > 0.001) {
              opmerkingen.push(`Aandelen van deze school samen ${som.toLocaleString('nl-NL')}%`);
            }
            if (terugval.has(r.id)) opmerkingen.push('Geen geschikte dagen: uren op de eerste dag');
            return opmerkingen.join('; ');
          },
        },
      ],
      velden: [
        {
          naam: 'medewerker_id',
          label: 'Medewerker',
          type: 'keuze',
          verplicht: true,
          opties: medewerkers.data
            .filter((m) => m.actief)
            .map((m) => ({ waarde: m.id, label: naamVan(m) })),
        },
        {
          naam: 'werkpakket_id',
          label: 'Werkpakket',
          type: 'keuze',
          verplicht: true,
          opties: werkpakketten.data
            .filter((w) => w.actief)
            .map((w) => ({ waarde: w.id, label: `${w.naam} (${w.soort}, ${w.vestiging})` })),
        },
        {
          naam: 'bron',
          label: 'Bron van de uren',
          type: 'keuze',
          verplicht: true,
          opties: opties(BRONNEN, BRONNAAM),
          hulp: 'School: staffel of handmatig. Activiteit: normuren × aantal of handmatig. Project: handmatig.',
        },
        {
          naam: 'aandeel_percentage',
          label: 'Aandeel van de staffeluren (%)',
          type: 'getal',
          zichtbaar: isBron('staffel'),
          hulp: 'Standaard 100. Bij twee LMC’ers op één school bijvoorbeeld 60 en 40.',
        },
        {
          naam: 'aantal_keer',
          label: 'Aantal keer',
          type: 'getal',
          verplicht: true,
          zichtbaar: isBron('norm_x_aantal'),
        },
        {
          naam: 'gepland_uitvoering',
          label: 'Uren uitvoering',
          type: 'getal',
          verplicht: true,
          zichtbaar: isBron('handmatig'),
        },
        {
          naam: 'gepland_voorbereiding',
          label: 'Uren voorbereiding',
          type: 'getal',
          verplicht: true,
          zichtbaar: isBron('handmatig'),
        },
        {
          naam: 'gepland_afronding',
          label: 'Uren afronding',
          type: 'getal',
          verplicht: true,
          zichtbaar: isBron('handmatig'),
        },
        {
          naam: 'verdeling',
          label: 'Verdeling',
          type: 'keuze',
          verplicht: true,
          opties: opties(VERDELINGEN, VERDELINGNAAM),
        },
        {
          naam: 'looptijd_van',
          label: 'Looptijd vanaf',
          type: 'datum',
          verplicht: true,
          zichtbaar: isVerdeling('looptijd'),
        },
        {
          naam: 'looptijd_tot',
          label: 'Looptijd tot en met',
          type: 'datum',
          verplicht: true,
          zichtbaar: isVerdeling('looptijd'),
        },
        {
          naam: 'datums',
          label: 'Datums',
          type: 'datumlijst',
          zichtbaar: isVerdeling('op_datum'),
          hulp: 'De uren worden gelijk over deze datums verdeeld.',
        },
        { naam: 'toelichting', label: 'Toelichting', type: 'tekstvak' },
      ],
      schema,
      leeg: () => ({
        medewerker_id: medewerkerFilter,
        werkpakket_id: '',
        bron: '',
        aandeel_percentage: '100',
        aantal_keer: '',
        gepland_uitvoering: '',
        gepland_voorbereiding: '',
        gepland_afronding: '',
        verdeling: 'schoolweken',
        looptijd_van: '',
        looptijd_tot: '',
        datums: '',
        toelichting: '',
      }),
      naarFormulier: (r) => ({
        medewerker_id: r.medewerker_id,
        werkpakket_id: r.werkpakket_id,
        bron: r.bron,
        aandeel_percentage: getal(r.aandeel_percentage),
        aantal_keer: getal(r.aantal_keer),
        gepland_uitvoering: getal(r.gepland_uitvoering),
        gepland_voorbereiding: getal(r.gepland_voorbereiding),
        gepland_afronding: getal(r.gepland_afronding),
        verdeling: r.verdeling,
        looptijd_van: r.looptijd_van ?? '',
        looptijd_tot: r.looptijd_tot ?? '',
        datums: (datumsVan.get(r.id) ?? []).join(','),
        toelichting: r.toelichting ?? '',
      }),
      opslaan: async (w, b) => {
        const { datums, ...velden } = w;
        const client = supabase();
        let id = b?.id;
        if (b) {
          const { error } = await client.from('toewijzing').update(velden).eq('id', b.id);
          if (error) throw error;
        } else {
          const { data, error } = await client
            .from('toewijzing')
            .insert({ ...velden, schooljaar_id: schooljaar.id })
            .select('id')
            .single();
          if (error) throw error;
          id = data.id;
        }
        if (id && (w.verdeling === 'op_datum' || b?.verdeling === 'op_datum')) {
          const { error } = await client.rpc('toewijzing_datums_vervangen', {
            p_toewijzing_id: id,
            p_datums: datums,
          });
          if (error) throw error;
        }
      },
      verwijder: async (r) => {
        const { error } = await supabase().from('toewijzing').delete().eq('id', r.id);
        if (error) throw error;
      },
      ookVernieuwen: [['toewijzing_extra', schooljaar.id], ['belasting']],
    };
    return definitie;
  }, [schooljaar, medewerkers.data, werkpakketten.data, extra.data, medewerkerFilter]);

  return (
    <>
      <div className="filters">
        <SchooljaarKiezer waarde={schooljaarId} onWijzig={setSchooljaarId} />
        <label className="veld">
          <span className="veld-label">Medewerker</span>
          <select
            value={medewerkerFilter}
            onChange={(e) => {
              setMedewerkerFilter(e.target.value);
            }}
          >
            <option value="">Alle medewerkers</option>
            {(medewerkers.data ?? []).map((m) => (
              <option key={m.id} value={m.id}>
                {naamVan(m)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {definitie ? (
        <BeheerScherm definitie={definitie} magBewerken={magBewerken} />
      ) : (
        <p aria-busy="true">Bezig met laden…</p>
      )}
    </>
  );
}
