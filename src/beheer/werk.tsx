// Werkschermen (SPEC §4, §6): scholen, leerlingen per schooljaar, activiteittypes,
// activiteiten, projecten en MATT-projecten.
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { supabase } from '../lib/supabase';
import { formatUren } from '../lib/opmaak';
import { BeheerScherm } from './BeheerScherm';
import {
  ophalen,
  opties,
  SCHOOLTYPEN,
  uitvoeren,
  useWerkpakketten,
  VESTIGINGEN,
  type Schooltype,
  type Vestiging,
} from './data';
import { SchooljaarKiezer } from './SchooljaarKiezer';
import { v } from './schema';
import type { BeheerDefinitie } from './types';

const vestigingVeld = {
  naam: 'vestiging',
  label: 'Vestiging',
  type: 'keuze',
  verplicht: true,
  opties: opties(VESTIGINGEN),
} as const;
const actiefVeld = {
  naam: 'actief',
  label: 'Actief',
  type: 'vinkje',
  hulp: 'Niet-actieve werkpakketten verschijnen niet meer in keuzelijsten.',
} as const;

// ---------------------------------------------------------------------------
// Scholen
// ---------------------------------------------------------------------------

type School = {
  id: string;
  naam: string;
  vestiging: Vestiging;
  actief: boolean;
  schooltype: Schooltype | null;
  adres: string | null;
  postcode: string | null;
  plaats: string | null;
};

export const schoolSchema = z.object({
  naam: v.tekst(200),
  vestiging: v.keuze(VESTIGINGEN),
  actief: v.vinkje(),
  schooltype: v.keuze(SCHOOLTYPEN),
  adres: v.optioneleTekst(200),
  postcode: z.preprocess(
    (w) => (typeof w === 'string' ? (w.trim() === '' ? null : w.trim().toUpperCase()) : w),
    z
      .string()
      .regex(/^[1-9][0-9]{3} ?[A-Z]{2}$/, 'Vul een postcode in, bijv. 3841 AB.')
      .nullable(),
  ),
  plaats: v.optioneleTekst(100),
});

async function laadScholen(): Promise<School[]> {
  const [pakketten, scholen] = await Promise.all([
    ophalen(
      supabase()
        .from('werkpakket')
        .select('id, naam, vestiging, actief')
        .eq('soort', 'school')
        .order('naam'),
    ),
    ophalen(supabase().from('school').select('werkpakket_id, schooltype, adres, postcode, plaats')),
  ]);
  const perId = new Map(scholen.map((s) => [s.werkpakket_id, s]));
  return pakketten.map((p) => {
    const s = perId.get(p.id);
    return {
      ...p,
      schooltype: s?.schooltype ?? null,
      adres: s?.adres ?? null,
      postcode: s?.postcode ?? null,
      plaats: s?.plaats ?? null,
    };
  });
}

const schoolDefinitie: BeheerDefinitie<School, z.infer<typeof schoolSchema>> = {
  titel: 'Scholen',
  enkelvoud: 'school',
  omschrijving:
    'dBos-scholen (PO, VO) en BoekStart-locaties. Het aantal leerlingen staat per schooljaar.',
  queryKey: ['school'],
  laad: laadScholen,
  sleutel: (r) => r.id,
  rijNaam: (r) => r.naam,
  kolommen: [
    { kop: 'Naam', waarde: (r) => r.naam, sorteer: (r) => r.naam },
    { kop: 'Type', waarde: (r) => r.schooltype ?? '', sorteer: (r) => r.schooltype ?? '' },
    { kop: 'Vestiging', waarde: (r) => r.vestiging, sorteer: (r) => r.vestiging },
    { kop: 'Plaats', waarde: (r) => r.plaats ?? '', sorteer: (r) => r.plaats ?? '' },
    {
      kop: 'Status',
      waarde: (r) => (r.actief ? 'Actief' : 'Niet actief'),
      sorteer: (r) => (r.actief ? 0 : 1),
    },
  ],
  velden: [
    { naam: 'naam', label: 'Naam', type: 'tekst', verplicht: true },
    {
      naam: 'schooltype',
      label: 'Schooltype',
      type: 'keuze',
      verplicht: true,
      opties: opties(SCHOOLTYPEN),
    },
    vestigingVeld,
    { naam: 'adres', label: 'Adres', type: 'tekst' },
    { naam: 'postcode', label: 'Postcode', type: 'tekst' },
    { naam: 'plaats', label: 'Plaats', type: 'tekst' },
    actiefVeld,
  ],
  schema: schoolSchema,
  leeg: () => ({
    naam: '',
    schooltype: '',
    vestiging: '',
    adres: '',
    postcode: '',
    plaats: '',
    actief: true,
  }),
  naarFormulier: (r) => ({
    naam: r.naam,
    schooltype: r.schooltype ?? '',
    vestiging: r.vestiging,
    adres: r.adres ?? '',
    postcode: r.postcode ?? '',
    plaats: r.plaats ?? '',
    actief: r.actief,
  }),
  opslaan: async (w, b) => {
    const { error } = await supabase().rpc('school_opslaan', {
      // Leeg = nieuwe school; de gegenereerde types kennen geen null-argumenten.
      p_werkpakket_id: (b?.id ?? null) as unknown as string,
      p_naam: w.naam,
      p_vestiging: w.vestiging,
      p_actief: w.actief,
      p_schooltype: w.schooltype,
      p_adres: w.adres as unknown as string,
      p_postcode: w.postcode as unknown as string,
      p_plaats: w.plaats as unknown as string,
    });
    if (error) throw error;
  },
  verwijder: (r) => uitvoeren(supabase().from('werkpakket').delete().eq('id', r.id)),
  ookVernieuwen: [['werkpakket'], ['school_schooljaar']],
};

export function Scholen({ magBewerken }: { magBewerken: boolean }) {
  return <BeheerScherm definitie={schoolDefinitie} magBewerken={magBewerken} />;
}

// ---------------------------------------------------------------------------
// Leerlingen per schooljaar (met afgeleide staffeluren)
// ---------------------------------------------------------------------------

type SchoolJaar = {
  id: string;
  school_id: string;
  aantal_leerlingen: number;
  uren_handmatig: number | null;
  toelichting: string | null;
};

type StaffelRegel = {
  schooltype: Schooltype;
  leerlingen_min: number;
  leerlingen_max: number | null;
  uren: number;
};

/** Staffeluren bij een schooltype en aantal leerlingen (zelfde regel als in de database). */
export function staffelurenVoor(
  schooltype: Schooltype | null,
  leerlingen: number,
  staffel: StaffelRegel[],
): number | null {
  if (!schooltype) return null;
  const regel = staffel.find(
    (s) =>
      s.schooltype === schooltype &&
      leerlingen >= s.leerlingen_min &&
      (s.leerlingen_max === null || leerlingen <= s.leerlingen_max),
  );
  return regel ? regel.uren : null;
}

export const schoolJaarSchema = z
  .object({
    school_id: z.string().min(1, 'Kies een school.'),
    aantal_leerlingen: v.getal({ min: 0, geheel: true }),
    uren_handmatig: v.optioneelGetal({ min: 0 }),
    toelichting: v.optioneleTekst(1000),
  })
  .refine((s) => s.uren_handmatig === null || (s.toelichting ?? '').length > 0, {
    path: ['toelichting'],
    message: 'Een handmatige afwijking vraagt een toelichting.',
  });

export function Leerlingen({ magBewerken }: { magBewerken: boolean }) {
  const [schooljaar, setSchooljaar] = useState<string | null>(null);
  const scholen = useQuery({ queryKey: ['school'], queryFn: laadScholen });
  const staffel = useQuery({
    queryKey: ['staffel', schooljaar],
    enabled: schooljaar !== null,
    queryFn: () =>
      ophalen(
        supabase()
          .from('staffel')
          .select('schooltype, leerlingen_min, leerlingen_max, uren')
          .eq('schooljaar_id', schooljaar ?? ''),
      ),
  });
  const opslag = useQuery({
    queryKey: ['opslagfactor', schooljaar],
    enabled: schooljaar !== null,
    queryFn: () =>
      ophalen(
        supabase()
          .from('opslagfactor')
          .select('schooltype, factor')
          .eq('schooljaar_id', schooljaar ?? ''),
      ),
  });

  const definitie = useMemo<BeheerDefinitie<
    SchoolJaar,
    z.infer<typeof schoolJaarSchema>
  > | null>(() => {
    if (!schooljaar || !scholen.data) return null;
    const schoolVan = new Map(scholen.data.map((s) => [s.id, s]));
    const factorVan = new Map((opslag.data ?? []).map((o) => [o.schooltype, o.factor]));
    const uren = (r: SchoolJaar) => {
      const school = schoolVan.get(r.school_id);
      const staffeluren =
        r.uren_handmatig ??
        staffelurenVoor(school?.schooltype ?? null, r.aantal_leerlingen, staffel.data ?? []);
      const factor = school?.schooltype ? (factorVan.get(school.schooltype) ?? 1) : 1;
      return { staffeluren, totaal: staffeluren === null ? null : staffeluren * factor };
    };
    return {
      titel: 'Leerlingen per schooljaar',
      enkelvoud: 'regel',
      omschrijving:
        'Het aantal leerlingen bepaalt de staffeluren. Een handmatige afwijking mag, met een verplichte toelichting.',
      queryKey: ['school_schooljaar', schooljaar],
      laad: () =>
        ophalen(
          supabase()
            .from('school_schooljaar')
            .select('id, school_id, aantal_leerlingen, uren_handmatig, toelichting')
            .eq('schooljaar_id', schooljaar),
        ),
      sleutel: (r) => r.id,
      rijNaam: (r) => schoolVan.get(r.school_id)?.naam ?? 'School',
      kolommen: [
        {
          kop: 'School',
          waarde: (r) => schoolVan.get(r.school_id)?.naam ?? '',
          sorteer: (r) => schoolVan.get(r.school_id)?.naam ?? '',
        },
        {
          kop: 'Leerlingen',
          waarde: (r) => r.aantal_leerlingen,
          sorteer: (r) => r.aantal_leerlingen,
          numeriek: true,
        },
        {
          kop: 'Staffeluren',
          waarde: (r) => {
            const u = uren(r).staffeluren;
            return u === null
              ? 'geen staffel'
              : `${formatUren(u)}${r.uren_handmatig === null ? '' : ' (handmatig)'}`;
          },
          numeriek: true,
        },
        { kop: 'Met opslag', waarde: (r) => formatUren(uren(r).totaal), numeriek: true },
      ],
      velden: [
        {
          naam: 'school_id',
          label: 'School',
          type: 'keuze',
          verplicht: true,
          opties: scholen.data
            .filter((s) => s.actief)
            .map((s) => ({ waarde: s.id, label: s.naam })),
          alleenLezen: (_, nieuw) => !nieuw,
        },
        { naam: 'aantal_leerlingen', label: 'Aantal leerlingen', type: 'getal', verplicht: true },
        {
          naam: 'uren_handmatig',
          label: 'Handmatige staffeluren',
          type: 'getal',
          hulp: 'Alleen invullen bij een afwijking van de staffel.',
        },
        { naam: 'toelichting', label: 'Toelichting', type: 'tekstvak' },
      ],
      schema: schoolJaarSchema,
      leeg: () => ({ school_id: '', aantal_leerlingen: '', uren_handmatig: '', toelichting: '' }),
      naarFormulier: (r) => ({
        school_id: r.school_id,
        aantal_leerlingen: String(r.aantal_leerlingen),
        uren_handmatig: r.uren_handmatig === null ? '' : r.uren_handmatig.toLocaleString('nl-NL'),
        toelichting: r.toelichting ?? '',
      }),
      opslaan: (w, b) =>
        uitvoeren(
          b
            ? supabase()
                .from('school_schooljaar')
                .update({
                  aantal_leerlingen: w.aantal_leerlingen,
                  uren_handmatig: w.uren_handmatig,
                  toelichting: w.toelichting,
                })
                .eq('id', b.id)
            : supabase()
                .from('school_schooljaar')
                .insert({ ...w, schooljaar_id: schooljaar }),
        ),
      verwijder: (r) => uitvoeren(supabase().from('school_schooljaar').delete().eq('id', r.id)),
    };
  }, [schooljaar, scholen.data, staffel.data, opslag.data]);

  return (
    <>
      <SchooljaarKiezer waarde={schooljaar} onWijzig={setSchooljaar} />
      {definitie ? <BeheerScherm definitie={definitie} magBewerken={magBewerken} /> : null}
    </>
  );
}

// ---------------------------------------------------------------------------
// Activiteittypes
// ---------------------------------------------------------------------------

type Activiteittype = {
  id: string;
  naam: string;
  normuren_uitvoering: number;
  normuren_voorbereiding: number;
  normuren_afronding: number;
};

export const activiteittypeSchema = z.object({
  naam: v.tekst(100),
  normuren_uitvoering: v.getal({ min: 0 }),
  normuren_voorbereiding: v.getal({ min: 0 }),
  normuren_afronding: v.getal({ min: 0 }),
});

const activiteittypeDefinitie: BeheerDefinitie<
  Activiteittype,
  z.infer<typeof activiteittypeSchema>
> = {
  titel: 'Activiteittypes',
  enkelvoud: 'activiteittype',
  omschrijving: 'Normuren gelden per keer.',
  queryKey: ['activiteittype'],
  laad: () => ophalen(supabase().from('activiteittype').select('*').order('naam')),
  sleutel: (r) => r.id,
  rijNaam: (r) => r.naam,
  kolommen: [
    { kop: 'Naam', waarde: (r) => r.naam, sorteer: (r) => r.naam },
    {
      kop: 'Uitvoering',
      waarde: (r) => formatUren(r.normuren_uitvoering),
      sorteer: (r) => r.normuren_uitvoering,
      numeriek: true,
    },
    {
      kop: 'Voorbereiding',
      waarde: (r) => formatUren(r.normuren_voorbereiding),
      sorteer: (r) => r.normuren_voorbereiding,
      numeriek: true,
    },
    {
      kop: 'Afronding',
      waarde: (r) => formatUren(r.normuren_afronding),
      sorteer: (r) => r.normuren_afronding,
      numeriek: true,
    },
  ],
  velden: [
    { naam: 'naam', label: 'Naam', type: 'tekst', verplicht: true },
    {
      naam: 'normuren_uitvoering',
      label: 'Normuren uitvoering (per keer)',
      type: 'getal',
      verplicht: true,
    },
    {
      naam: 'normuren_voorbereiding',
      label: 'Normuren voorbereiding (per keer)',
      type: 'getal',
      verplicht: true,
    },
    {
      naam: 'normuren_afronding',
      label: 'Normuren afronding (per keer)',
      type: 'getal',
      verplicht: true,
    },
  ],
  schema: activiteittypeSchema,
  leeg: () => ({
    naam: '',
    normuren_uitvoering: '0',
    normuren_voorbereiding: '0',
    normuren_afronding: '0',
  }),
  naarFormulier: (r) => ({
    naam: r.naam,
    normuren_uitvoering: r.normuren_uitvoering.toLocaleString('nl-NL'),
    normuren_voorbereiding: r.normuren_voorbereiding.toLocaleString('nl-NL'),
    normuren_afronding: r.normuren_afronding.toLocaleString('nl-NL'),
  }),
  opslaan: (w, b) =>
    uitvoeren(
      b
        ? supabase().from('activiteittype').update(w).eq('id', b.id)
        : supabase().from('activiteittype').insert(w),
    ),
  verwijder: (r) => uitvoeren(supabase().from('activiteittype').delete().eq('id', r.id)),
};

export function Activiteittypes({ magBewerken }: { magBewerken: boolean }) {
  return <BeheerScherm definitie={activiteittypeDefinitie} magBewerken={magBewerken} />;
}

// ---------------------------------------------------------------------------
// Activiteiten en projecten (werkpakketten)
// ---------------------------------------------------------------------------

type Werkpakket = {
  id: string;
  naam: string;
  vestiging: Vestiging;
  actief: boolean;
  activiteittype_id: string | null;
};

export const activiteitSchema = z.object({
  naam: v.tekst(200),
  vestiging: v.keuze(VESTIGINGEN),
  activiteittype_id: z.string().min(1, 'Kies een activiteittype.'),
  actief: v.vinkje(),
});

export function Activiteiten({ magBewerken }: { magBewerken: boolean }) {
  const types = useQuery({ queryKey: ['activiteittype'], queryFn: activiteittypeDefinitie.laad });
  const definitie = useMemo<BeheerDefinitie<
    Werkpakket,
    z.infer<typeof activiteitSchema>
  > | null>(() => {
    if (!types.data) return null;
    const typeNaam = new Map(types.data.map((t) => [t.id, t.naam]));
    return {
      titel: 'Activiteiten',
      enkelvoud: 'activiteit',
      omschrijving: 'Terugkerende activiteiten zoals Digilab, Boekjes & Babbels en Peuterbieb.',
      queryKey: ['werkpakket', 'activiteit'],
      laad: () =>
        ophalen(
          supabase()
            .from('werkpakket')
            .select('id, naam, vestiging, actief, activiteittype_id')
            .eq('soort', 'activiteit')
            .order('naam'),
        ),
      sleutel: (r) => r.id,
      rijNaam: (r) => r.naam,
      kolommen: [
        { kop: 'Naam', waarde: (r) => r.naam, sorteer: (r) => r.naam },
        {
          kop: 'Type',
          waarde: (r) => typeNaam.get(r.activiteittype_id ?? '') ?? '',
          sorteer: (r) => typeNaam.get(r.activiteittype_id ?? '') ?? '',
        },
        { kop: 'Vestiging', waarde: (r) => r.vestiging, sorteer: (r) => r.vestiging },
        {
          kop: 'Status',
          waarde: (r) => (r.actief ? 'Actief' : 'Niet actief'),
          sorteer: (r) => (r.actief ? 0 : 1),
        },
      ],
      velden: [
        { naam: 'naam', label: 'Naam', type: 'tekst', verplicht: true },
        {
          naam: 'activiteittype_id',
          label: 'Activiteittype',
          type: 'keuze',
          verplicht: true,
          opties: types.data.map((t) => ({ waarde: t.id, label: t.naam })),
        },
        vestigingVeld,
        actiefVeld,
      ],
      schema: activiteitSchema,
      leeg: () => ({ naam: '', activiteittype_id: '', vestiging: '', actief: true }),
      naarFormulier: (r) => ({
        naam: r.naam,
        activiteittype_id: r.activiteittype_id ?? '',
        vestiging: r.vestiging,
        actief: r.actief,
      }),
      opslaan: (w, b) =>
        uitvoeren(
          b
            ? supabase().from('werkpakket').update(w).eq('id', b.id)
            : supabase()
                .from('werkpakket')
                .insert({ ...w, soort: 'activiteit' }),
        ),
      verwijder: (r) => uitvoeren(supabase().from('werkpakket').delete().eq('id', r.id)),
      ookVernieuwen: [['werkpakket']],
    };
  }, [types.data]);
  return definitie ? <BeheerScherm definitie={definitie} magBewerken={magBewerken} /> : null;
}

export const projectSchema = z.object({
  naam: v.tekst(200),
  vestiging: v.keuze(VESTIGINGEN),
  actief: v.vinkje(),
});

const projectDefinitie: BeheerDefinitie<Werkpakket, z.infer<typeof projectSchema>> = {
  titel: 'Projecten',
  enkelvoud: 'project',
  omschrijving: 'Projecten zoals de Nationale Voorleesdagen en de Kinderboekenweek.',
  queryKey: ['werkpakket', 'project'],
  laad: () =>
    ophalen(
      supabase()
        .from('werkpakket')
        .select('id, naam, vestiging, actief, activiteittype_id')
        .eq('soort', 'project')
        .order('naam'),
    ),
  sleutel: (r) => r.id,
  rijNaam: (r) => r.naam,
  kolommen: [
    { kop: 'Naam', waarde: (r) => r.naam, sorteer: (r) => r.naam },
    { kop: 'Vestiging', waarde: (r) => r.vestiging, sorteer: (r) => r.vestiging },
    {
      kop: 'Status',
      waarde: (r) => (r.actief ? 'Actief' : 'Niet actief'),
      sorteer: (r) => (r.actief ? 0 : 1),
    },
  ],
  velden: [
    { naam: 'naam', label: 'Naam', type: 'tekst', verplicht: true },
    vestigingVeld,
    actiefVeld,
  ],
  schema: projectSchema,
  leeg: () => ({ naam: '', vestiging: 'overig', actief: true }),
  naarFormulier: (r) => ({ naam: r.naam, vestiging: r.vestiging, actief: r.actief }),
  opslaan: (w, b) =>
    uitvoeren(
      b
        ? supabase().from('werkpakket').update(w).eq('id', b.id)
        : supabase()
            .from('werkpakket')
            .insert({ ...w, soort: 'project' }),
    ),
  verwijder: (r) => uitvoeren(supabase().from('werkpakket').delete().eq('id', r.id)),
  ookVernieuwen: [['werkpakket']],
};

export function Projecten({ magBewerken }: { magBewerken: boolean }) {
  return <BeheerScherm definitie={projectDefinitie} magBewerken={magBewerken} />;
}

// ---------------------------------------------------------------------------
// MATT-projecten
// ---------------------------------------------------------------------------

type MattProject = {
  id: string;
  projectnummer: string;
  naam_laatst_gezien: string | null;
  werkpakket_id: string | null;
  genegeerd: boolean;
};

export const mattProjectSchema = z.object({
  projectnummer: v.tekst(50).regex(/^\S+$/, 'Geen spaties.'),
  naam_laatst_gezien: v.optioneleTekst(500),
  werkpakket_id: v.optioneleKeuze(),
  genegeerd: v.vinkje(),
});

export function MattProjecten({ magBewerken }: { magBewerken: boolean }) {
  const werkpakketten = useWerkpakketten();
  const [alleenOngekoppeld, setAlleenOngekoppeld] = useState(false);
  const definitie = useMemo<BeheerDefinitie<
    MattProject,
    z.infer<typeof mattProjectSchema>
  > | null>(() => {
    if (!werkpakketten.data) return null;
    const pakket = new Map(werkpakketten.data.map((w) => [w.id, w]));
    return {
      titel: 'MATT-projecten',
      enkelvoud: 'MATT-project',
      omschrijving:
        'Koppeling van MATT-projectnummers aan werkpakketten. Er wordt alleen op projectnummer gematcht, nooit op naam. Genegeerde projecten tellen niet mee in de belasting.',
      queryKey: ['matt_project', alleenOngekoppeld],
      laad: () => {
        const q = supabase()
          .from('matt_project')
          .select('id, projectnummer, naam_laatst_gezien, werkpakket_id, genegeerd')
          .order('projectnummer');
        return ophalen(alleenOngekoppeld ? q.is('werkpakket_id', null).eq('genegeerd', false) : q);
      },
      sleutel: (r) => r.id,
      rijNaam: (r) => `Project ${r.projectnummer}`,
      kolommen: [
        { kop: 'Nummer', waarde: (r) => r.projectnummer, sorteer: (r) => r.projectnummer },
        {
          kop: 'Naam in MATT',
          waarde: (r) => r.naam_laatst_gezien ?? '',
          sorteer: (r) => r.naam_laatst_gezien ?? '',
        },
        {
          kop: 'Werkpakket',
          waarde: (r) =>
            r.genegeerd
              ? 'Genegeerd'
              : r.werkpakket_id
                ? (pakket.get(r.werkpakket_id)?.naam ?? '')
                : 'Niet gekoppeld',
          sorteer: (r) => (r.werkpakket_id ? (pakket.get(r.werkpakket_id)?.naam ?? '') : ''),
        },
      ],
      velden: [
        {
          naam: 'projectnummer',
          label: 'Projectnummer',
          type: 'tekst',
          verplicht: true,
          alleenLezen: (_, nieuw) => !nieuw,
        },
        {
          naam: 'naam_laatst_gezien',
          label: 'Naam in MATT',
          type: 'tekst',
          alleenLezen: (_, nieuw) => !nieuw,
          hulp: 'Wordt bij elke import bijgewerkt; alleen ter herkenning.',
        },
        {
          naam: 'werkpakket_id',
          label: 'Werkpakket',
          type: 'keuze',
          legeOptie: 'Niet gekoppeld',
          opties: werkpakketten.data
            .filter((w) => w.actief)
            .map((w) => ({ waarde: w.id, label: `${w.naam} (${w.soort})` })),
        },
        {
          naam: 'genegeerd',
          label: 'Negeren',
          type: 'vinkje',
          hulp: 'Telt dan niet mee in de belasting.',
        },
      ],
      schema: mattProjectSchema,
      leeg: () => ({
        projectnummer: '',
        naam_laatst_gezien: '',
        werkpakket_id: '',
        genegeerd: false,
      }),
      naarFormulier: (r) => ({
        projectnummer: r.projectnummer,
        naam_laatst_gezien: r.naam_laatst_gezien ?? '',
        werkpakket_id: r.werkpakket_id ?? '',
        genegeerd: r.genegeerd,
      }),
      opslaan: (w, b) =>
        uitvoeren(
          b
            ? supabase()
                .from('matt_project')
                .update({ werkpakket_id: w.werkpakket_id, genegeerd: w.genegeerd })
                .eq('id', b.id)
            : supabase().from('matt_project').insert(w),
        ),
      verwijder: (r) => uitvoeren(supabase().from('matt_project').delete().eq('id', r.id)),
    };
  }, [werkpakketten.data, alleenOngekoppeld]);

  return (
    <>
      <label className="veld-vinkje">
        <input
          type="checkbox"
          checked={alleenOngekoppeld}
          onChange={(e) => {
            setAlleenOngekoppeld(e.target.checked);
          }}
        />
        Alleen niet-gekoppelde MATT-projecten
      </label>
      {definitie ? <BeheerScherm definitie={definitie} magBewerken={magBewerken} /> : null}
    </>
  );
}
