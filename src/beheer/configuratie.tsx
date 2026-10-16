// Configuratieschermen (SPEC §4, §6): schooljaren, schoolvakanties, feestdagen,
// staffel, opslagfactoren, instellingen en de MATT-artikelmapping.
import { useMemo, useState } from 'react';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { vertaalFout } from '../lib/fouten';
import { formatDatum, formatUren } from '../lib/opmaak';
import { BeheerScherm } from './BeheerScherm';
import {
  CATEGORIEEN,
  CATEGORIENAAM,
  ophalen,
  opties,
  SCHOOLTYPEN,
  uitvoeren,
  useSchooljaren,
  type Categorie,
  type Schooljaar,
  type Schooltype,
} from './data';
import { SchooljaarKiezer } from './SchooljaarKiezer';
import { v } from './schema';
import type { BeheerDefinitie } from './types';

// ---------------------------------------------------------------------------
// Schooljaren
// ---------------------------------------------------------------------------

export const schooljaarSchema = z
  .object({
    naam: v.tekst(9).regex(/^\d{4}-\d{4}$/, 'Gebruik de vorm 2026-2027.'),
    startdatum: v.datum(),
    einddatum: v.datum(),
  })
  .refine((s) => s.einddatum > s.startdatum, {
    path: ['einddatum'],
    message: 'De einddatum ligt na de startdatum.',
  });

const schooljaarDefinitie: BeheerDefinitie<Schooljaar, z.infer<typeof schooljaarSchema>> = {
  titel: 'Schooljaren',
  enkelvoud: 'schooljaar',
  omschrijving: 'Een schooljaar loopt normaal van 1 augustus tot en met 31 juli.',
  queryKey: ['schooljaar'],
  laad: () => ophalen(supabase().from('schooljaar').select('*').order('startdatum')),
  sleutel: (r) => r.id,
  rijNaam: (r) => `Schooljaar ${r.naam}`,
  kolommen: [
    { kop: 'Naam', waarde: (r) => r.naam, sorteer: (r) => r.naam },
    { kop: 'Start', waarde: (r) => formatDatum(r.startdatum), sorteer: (r) => r.startdatum },
    { kop: 'Einde', waarde: (r) => formatDatum(r.einddatum), sorteer: (r) => r.einddatum },
  ],
  velden: [
    {
      naam: 'naam',
      label: 'Naam',
      type: 'tekst',
      verplicht: true,
      hulp: 'Bijvoorbeeld 2027-2028.',
    },
    { naam: 'startdatum', label: 'Startdatum', type: 'datum', verplicht: true },
    { naam: 'einddatum', label: 'Einddatum', type: 'datum', verplicht: true },
  ],
  schema: schooljaarSchema,
  leeg: () => {
    const jaar = new Date().getFullYear();
    return {
      naam: `${String(jaar)}-${String(jaar + 1)}`,
      startdatum: `${String(jaar)}-08-01`,
      einddatum: `${String(jaar + 1)}-07-31`,
    };
  },
  naarFormulier: (r) => ({ naam: r.naam, startdatum: r.startdatum, einddatum: r.einddatum }),
  opslaan: (w, b) =>
    uitvoeren(
      b
        ? supabase().from('schooljaar').update(w).eq('id', b.id)
        : supabase().from('schooljaar').insert(w),
    ),
  verwijder: (r) => uitvoeren(supabase().from('schooljaar').delete().eq('id', r.id)),
};

function ConfiguratieKopieren() {
  const schooljaren = useSchooljaren();
  const queryClient = useQueryClient();
  const [van, setVan] = useState('');
  const [naar, setNaar] = useState('');
  const [melding, setMelding] = useState<string | null>(null);
  const kopieer = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase().rpc('schooljaar_configuratie_kopieren', {
        p_van_id: van,
        p_naar_id: naar,
      });
      if (error) throw error;
      return data as { staffel: number; opslagfactor: number; schoolvakantie: number };
    },
    onSuccess: async (r) => {
      setMelding(
        `Gekopieerd: ${String(r.staffel)} staffelregels, ${String(r.opslagfactor)} opslagfactoren en ${String(r.schoolvakantie)} schoolvakanties. Controleer de vakantiedatums en bevestig de opslagfactoren.`,
      );
      for (const k of ['staffel', 'opslagfactor', 'schoolvakantie']) {
        await queryClient.invalidateQueries({ queryKey: [k] });
      }
    },
    onError: (e) => {
      setMelding(vertaalFout(e));
    },
  });

  return (
    <section className="kader" aria-labelledby="kopieren-titel">
      <h3 id="kopieren-titel">Configuratie overnemen uit een ander schooljaar</h3>
      <p className="toelichting">
        Neemt de staffel, de opslagfactoren (opnieuw &quot;nog te bevestigen&quot;) en de
        schoolvakanties over, met de datums één schooljaar verschoven. Toewijzingen worden niet
        gekopieerd. Het doel-schooljaar moet nog leeg zijn.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setMelding(null);
          kopieer.mutate();
        }}
      >
        <label>
          Van
          <select
            required
            value={van}
            onChange={(e) => {
              setVan(e.target.value);
            }}
          >
            <option value="">— kies —</option>
            {(schooljaren.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.naam}
              </option>
            ))}
          </select>
        </label>
        <label>
          Naar
          <select
            required
            value={naar}
            onChange={(e) => {
              setNaar(e.target.value);
            }}
          >
            <option value="">— kies —</option>
            {(schooljaren.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.naam}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" disabled={!van || !naar || van === naar || kopieer.isPending}>
          Overnemen
        </button>
        <p className="melding" role="status" aria-live="polite">
          {melding ?? ''}
        </p>
      </form>
    </section>
  );
}

export function Schooljaren({ magBewerken }: { magBewerken: boolean }) {
  return (
    <>
      <BeheerScherm definitie={schooljaarDefinitie} magBewerken={magBewerken} />
      {magBewerken ? <ConfiguratieKopieren /> : null}
    </>
  );
}

// ---------------------------------------------------------------------------
// Schoolvakanties (per schooljaar)
// ---------------------------------------------------------------------------

type Schoolvakantie = { id: string; schooljaar_id: string; naam: string; van: string; tot: string };

export const vakantieSchema = z
  .object({ naam: v.tekst(100), van: v.datum(), tot: v.datum() })
  .refine((s) => s.tot >= s.van, {
    path: ['tot'],
    message: 'De einddatum ligt niet voor de begindatum.',
  });

export function Schoolvakanties({ magBewerken }: { magBewerken: boolean }) {
  const [schooljaar, setSchooljaar] = useState<string | null>(null);
  const definitie = useMemo<BeheerDefinitie<Schoolvakantie, z.infer<typeof vakantieSchema>> | null>(
    () =>
      schooljaar
        ? {
            titel: 'Schoolvakanties',
            enkelvoud: 'schoolvakantie',
            omschrijving:
              'Een vakantie ligt binnen één schooljaar; leg een zomervakantie over de jaargrens in twee delen vast.',
            queryKey: ['schoolvakantie', schooljaar],
            laad: () =>
              ophalen(
                supabase()
                  .from('schoolvakantie')
                  .select('*')
                  .eq('schooljaar_id', schooljaar)
                  .order('van'),
              ),
            sleutel: (r) => r.id,
            rijNaam: (r) => r.naam,
            kolommen: [
              { kop: 'Naam', waarde: (r) => r.naam, sorteer: (r) => r.naam },
              { kop: 'Van', waarde: (r) => formatDatum(r.van), sorteer: (r) => r.van },
              { kop: 'Tot en met', waarde: (r) => formatDatum(r.tot), sorteer: (r) => r.tot },
            ],
            velden: [
              { naam: 'naam', label: 'Naam', type: 'tekst', verplicht: true },
              { naam: 'van', label: 'Van', type: 'datum', verplicht: true },
              { naam: 'tot', label: 'Tot en met', type: 'datum', verplicht: true },
            ],
            schema: vakantieSchema,
            leeg: () => ({ naam: '', van: '', tot: '' }),
            naarFormulier: (r) => ({ naam: r.naam, van: r.van, tot: r.tot }),
            opslaan: (w, b) =>
              uitvoeren(
                b
                  ? supabase().from('schoolvakantie').update(w).eq('id', b.id)
                  : supabase()
                      .from('schoolvakantie')
                      .insert({ ...w, schooljaar_id: schooljaar }),
              ),
            verwijder: (r) => uitvoeren(supabase().from('schoolvakantie').delete().eq('id', r.id)),
          }
        : null,
    [schooljaar],
  );
  return (
    <>
      <SchooljaarKiezer waarde={schooljaar} onWijzig={setSchooljaar} />
      {definitie ? <BeheerScherm definitie={definitie} magBewerken={magBewerken} /> : null}
    </>
  );
}

// ---------------------------------------------------------------------------
// Feestdagen
// ---------------------------------------------------------------------------

type Feestdag = { id: string; datum: string; naam: string };
export const feestdagSchema = z.object({ datum: v.datum(), naam: v.tekst(100) });

const feestdagDefinitie: BeheerDefinitie<Feestdag, z.infer<typeof feestdagSchema>> = {
  titel: 'Feestdagen',
  enkelvoud: 'feestdag',
  omschrijving: 'Op een feestdag is de capaciteit 0. Een feestdag in het weekend telt niet mee.',
  queryKey: ['feestdag'],
  laad: () => ophalen(supabase().from('feestdag').select('*').order('datum')),
  sleutel: (r) => r.id,
  rijNaam: (r) => `${r.naam} (${formatDatum(r.datum)})`,
  kolommen: [
    { kop: 'Datum', waarde: (r) => formatDatum(r.datum), sorteer: (r) => r.datum },
    { kop: 'Naam', waarde: (r) => r.naam, sorteer: (r) => r.naam },
  ],
  velden: [
    { naam: 'datum', label: 'Datum', type: 'datum', verplicht: true },
    { naam: 'naam', label: 'Naam', type: 'tekst', verplicht: true },
  ],
  schema: feestdagSchema,
  leeg: () => ({ datum: '', naam: '' }),
  naarFormulier: (r) => ({ datum: r.datum, naam: r.naam }),
  opslaan: (w, b) =>
    uitvoeren(
      b
        ? supabase().from('feestdag').update(w).eq('id', b.id)
        : supabase().from('feestdag').insert(w),
    ),
  verwijder: (r) => uitvoeren(supabase().from('feestdag').delete().eq('id', r.id)),
};

export function Feestdagen({ magBewerken }: { magBewerken: boolean }) {
  return <BeheerScherm definitie={feestdagDefinitie} magBewerken={magBewerken} />;
}

// ---------------------------------------------------------------------------
// Staffel (per schooljaar)
// ---------------------------------------------------------------------------

type Staffel = {
  id: string;
  schooltype: Schooltype;
  leerlingen_min: number;
  leerlingen_max: number | null;
  uren: number;
};

export const staffelSchema = z
  .object({
    schooltype: v.keuze(SCHOOLTYPEN),
    leerlingen_min: v.getal({ min: 0, geheel: true }),
    leerlingen_max: v.optioneelGetal({ min: 0, geheel: true }),
    uren: v.getal({ min: 0 }),
  })
  .refine((s) => s.leerlingen_max === null || s.leerlingen_max >= s.leerlingen_min, {
    path: ['leerlingen_max'],
    message: 'Het maximum is niet kleiner dan het minimum.',
  });

export function Staffels({ magBewerken }: { magBewerken: boolean }) {
  const [schooljaar, setSchooljaar] = useState<string | null>(null);
  const definitie = useMemo<BeheerDefinitie<Staffel, z.infer<typeof staffelSchema>> | null>(
    () =>
      schooljaar
        ? {
            titel: 'Staffel',
            enkelvoud: 'staffelregel',
            omschrijving:
              'Uren op jaarbasis per schooltype en aantal leerlingen. Een leeg maximum betekent: geen bovengrens. Bereiken mogen niet overlappen.',
            queryKey: ['staffel', schooljaar],
            laad: () =>
              ophalen(
                supabase()
                  .from('staffel')
                  .select('id, schooltype, leerlingen_min, leerlingen_max, uren')
                  .eq('schooljaar_id', schooljaar)
                  .order('schooltype')
                  .order('leerlingen_min'),
              ),
            sleutel: (r) => r.id,
            rijNaam: (r) =>
              `${r.schooltype} ${String(r.leerlingen_min)}–${r.leerlingen_max === null ? '…' : String(r.leerlingen_max)} leerlingen`,
            kolommen: [
              { kop: 'Schooltype', waarde: (r) => r.schooltype, sorteer: (r) => r.schooltype },
              {
                kop: 'Leerlingen',
                waarde: (r) =>
                  `${String(r.leerlingen_min)} – ${r.leerlingen_max === null ? 'onbeperkt' : String(r.leerlingen_max)}`,
                sorteer: (r) => r.leerlingen_min,
                numeriek: true,
              },
              {
                kop: 'Uren',
                waarde: (r) => formatUren(r.uren),
                sorteer: (r) => r.uren,
                numeriek: true,
              },
            ],
            velden: [
              {
                naam: 'schooltype',
                label: 'Schooltype',
                type: 'keuze',
                verplicht: true,
                opties: opties(SCHOOLTYPEN),
              },
              { naam: 'leerlingen_min', label: 'Leerlingen vanaf', type: 'getal', verplicht: true },
              {
                naam: 'leerlingen_max',
                label: 'Leerlingen tot en met',
                type: 'getal',
                hulp: 'Leeg = geen bovengrens.',
              },
              { naam: 'uren', label: 'Uren per schooljaar', type: 'getal', verplicht: true },
            ],
            schema: staffelSchema,
            leeg: () => ({ schooltype: '', leerlingen_min: '0', leerlingen_max: '', uren: '' }),
            naarFormulier: (r) => ({
              schooltype: r.schooltype,
              leerlingen_min: String(r.leerlingen_min),
              leerlingen_max: r.leerlingen_max === null ? '' : String(r.leerlingen_max),
              uren: String(r.uren),
            }),
            opslaan: (w, b) =>
              uitvoeren(
                b
                  ? supabase().from('staffel').update(w).eq('id', b.id)
                  : supabase()
                      .from('staffel')
                      .insert({ ...w, schooljaar_id: schooljaar }),
              ),
            verwijder: (r) => uitvoeren(supabase().from('staffel').delete().eq('id', r.id)),
          }
        : null,
    [schooljaar],
  );
  return (
    <>
      <SchooljaarKiezer waarde={schooljaar} onWijzig={setSchooljaar} />
      {definitie ? <BeheerScherm definitie={definitie} magBewerken={magBewerken} /> : null}
    </>
  );
}

// ---------------------------------------------------------------------------
// Opslagfactoren (per schooljaar)
// ---------------------------------------------------------------------------

type Opslag = { id: string; schooltype: Schooltype; factor: number; bevestigd: boolean };
export const opslagSchema = z.object({
  schooltype: v.keuze(SCHOOLTYPEN),
  factor: v.getal({ min: 0.01, max: 10 }),
  bevestigd: v.vinkje(),
});

export function Opslagfactoren({ magBewerken }: { magBewerken: boolean }) {
  const [schooljaar, setSchooljaar] = useState<string | null>(null);
  const definitie = useMemo<BeheerDefinitie<Opslag, z.infer<typeof opslagSchema>> | null>(
    () =>
      schooljaar
        ? {
            titel: 'Opslagfactoren',
            enkelvoud: 'opslagfactor',
            omschrijving:
              'Staffeluren × opslagfactor = geplande uren voor een school. De opslag telt als voorbereiding en afronding.',
            queryKey: ['opslagfactor', schooljaar],
            laad: () =>
              ophalen(
                supabase()
                  .from('opslagfactor')
                  .select('id, schooltype, factor, bevestigd')
                  .eq('schooljaar_id', schooljaar)
                  .order('schooltype'),
              ),
            sleutel: (r) => r.id,
            rijNaam: (r) => `Opslagfactor ${r.schooltype}`,
            kolommen: [
              { kop: 'Schooltype', waarde: (r) => r.schooltype, sorteer: (r) => r.schooltype },
              {
                kop: 'Factor',
                waarde: (r) => r.factor.toLocaleString('nl-NL'),
                sorteer: (r) => r.factor,
                numeriek: true,
              },
              {
                kop: 'Status',
                waarde: (r) => (r.bevestigd ? 'Bevestigd' : 'Nog te bevestigen'),
                sorteer: (r) => (r.bevestigd ? 1 : 0),
              },
            ],
            velden: [
              {
                naam: 'schooltype',
                label: 'Schooltype',
                type: 'keuze',
                verplicht: true,
                opties: opties(SCHOOLTYPEN),
              },
              {
                naam: 'factor',
                label: 'Factor',
                type: 'getal',
                verplicht: true,
                hulp: 'Bijvoorbeeld 2,0.',
              },
              { naam: 'bevestigd', label: 'Bevestigd', type: 'vinkje' },
            ],
            schema: opslagSchema,
            leeg: () => ({ schooltype: '', factor: '2,0', bevestigd: false }),
            naarFormulier: (r) => ({
              schooltype: r.schooltype,
              factor: r.factor.toLocaleString('nl-NL'),
              bevestigd: r.bevestigd,
            }),
            opslaan: (w, b) =>
              uitvoeren(
                b
                  ? supabase().from('opslagfactor').update(w).eq('id', b.id)
                  : supabase()
                      .from('opslagfactor')
                      .insert({ ...w, schooljaar_id: schooljaar }),
              ),
            verwijder: (r) => uitvoeren(supabase().from('opslagfactor').delete().eq('id', r.id)),
          }
        : null,
    [schooljaar],
  );
  return (
    <>
      <SchooljaarKiezer waarde={schooljaar} onWijzig={setSchooljaar} />
      {definitie ? <BeheerScherm definitie={definitie} magBewerken={magBewerken} /> : null}
    </>
  );
}

// ---------------------------------------------------------------------------
// Instellingen
// ---------------------------------------------------------------------------

export const SLEUTELS = [
  'overhead_percentage',
  'grens_vol',
  'grens_boven_capaciteit',
  'toegestaan_email_domein',
] as const;
const SLEUTELNAAM: Record<(typeof SLEUTELS)[number], string> = {
  overhead_percentage: 'Overhead (%)',
  grens_vol: 'Grens "vol" (%)',
  grens_boven_capaciteit: 'Grens "boven capaciteit" (%)',
  toegestaan_email_domein: 'Toegestaan e-maildomein',
};

type Instelling = { id: string; sleutel: string; waarde: string; ingangsdatum: string };

export const instellingSchema = z
  .object({
    sleutel: v.keuze(SLEUTELS),
    waarde: v.tekst(253),
    ingangsdatum: v.datum(),
  })
  .superRefine((s, ctx) => {
    if (s.sleutel === 'toegestaan_email_domein') {
      if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(s.waarde)) {
        ctx.addIssue({
          code: 'custom',
          path: ['waarde'],
          message: 'Vul een domeinnaam in, bijv. voorbeeld.nl.',
        });
      }
    } else if (!/^\d{1,4}(\.\d+)?$/.test(s.waarde) || Number(s.waarde) > 1000) {
      ctx.addIssue({
        code: 'custom',
        path: ['waarde'],
        message: 'Vul een getal in (punt als decimaalteken).',
      });
    }
  });

const instellingDefinitie: BeheerDefinitie<Instelling, z.infer<typeof instellingSchema>> = {
  titel: 'Instellingen',
  enkelvoud: 'instelling',
  omschrijving:
    'Elke instelling geldt vanaf de ingangsdatum tot een volgende waarde ingaat. Voeg bij een wijziging een nieuwe regel toe, zodat de historie bewaard blijft.',
  queryKey: ['instelling'],
  laad: () =>
    ophalen(supabase().from('instelling').select('*').order('sleutel').order('ingangsdatum')),
  sleutel: (r) => r.id,
  rijNaam: (r) =>
    `${SLEUTELNAAM[r.sleutel as (typeof SLEUTELS)[number]]} per ${formatDatum(r.ingangsdatum)}`,
  kolommen: [
    {
      kop: 'Instelling',
      waarde: (r) => SLEUTELNAAM[r.sleutel as (typeof SLEUTELS)[number]],
      sorteer: (r) => r.sleutel,
    },
    { kop: 'Waarde', waarde: (r) => r.waarde, sorteer: (r) => r.waarde },
    {
      kop: 'Geldig vanaf',
      waarde: (r) => formatDatum(r.ingangsdatum),
      sorteer: (r) => r.ingangsdatum,
    },
  ],
  velden: [
    {
      naam: 'sleutel',
      label: 'Instelling',
      type: 'keuze',
      verplicht: true,
      opties: opties(SLEUTELS, SLEUTELNAAM),
    },
    { naam: 'waarde', label: 'Waarde', type: 'tekst', verplicht: true },
    { naam: 'ingangsdatum', label: 'Geldig vanaf', type: 'datum', verplicht: true },
  ],
  schema: instellingSchema,
  leeg: () => ({ sleutel: '', waarde: '', ingangsdatum: new Date().toISOString().slice(0, 10) }),
  naarFormulier: (r) => ({ sleutel: r.sleutel, waarde: r.waarde, ingangsdatum: r.ingangsdatum }),
  opslaan: (w, b) =>
    uitvoeren(
      b
        ? supabase().from('instelling').update(w).eq('id', b.id)
        : supabase().from('instelling').insert(w),
    ),
  verwijder: (r) => uitvoeren(supabase().from('instelling').delete().eq('id', r.id)),
};

export function Instellingen({ magBewerken }: { magBewerken: boolean }) {
  return <BeheerScherm definitie={instellingDefinitie} magBewerken={magBewerken} />;
}

// ---------------------------------------------------------------------------
// MATT-artikelmapping
// ---------------------------------------------------------------------------

type Mapping = { id: string; artikelcode: string; categorie: Categorie };
export const mappingSchema = z.object({
  artikelcode: v.tekst(50).regex(/^\S+$/, 'Geen spaties.'),
  categorie: v.keuze(CATEGORIEEN),
});

const mappingDefinitie: BeheerDefinitie<Mapping, z.infer<typeof mappingSchema>> = {
  titel: 'MATT-artikelcodes',
  enkelvoud: 'artikelcode',
  omschrijving: 'Welke MATT-artikelcode bij welke categorie hoort.',
  queryKey: ['matt_artikel_mapping'],
  laad: () => ophalen(supabase().from('matt_artikel_mapping').select('*').order('artikelcode')),
  sleutel: (r) => r.id,
  rijNaam: (r) => `Artikelcode ${r.artikelcode}`,
  kolommen: [
    { kop: 'Artikelcode', waarde: (r) => r.artikelcode, sorteer: (r) => r.artikelcode },
    { kop: 'Categorie', waarde: (r) => CATEGORIENAAM[r.categorie], sorteer: (r) => r.categorie },
  ],
  velden: [
    { naam: 'artikelcode', label: 'Artikelcode', type: 'tekst', verplicht: true },
    {
      naam: 'categorie',
      label: 'Categorie',
      type: 'keuze',
      verplicht: true,
      opties: opties(CATEGORIEEN, CATEGORIENAAM),
    },
  ],
  schema: mappingSchema,
  leeg: () => ({ artikelcode: '', categorie: '' }),
  naarFormulier: (r) => ({ artikelcode: r.artikelcode, categorie: r.categorie }),
  opslaan: (w, b) =>
    uitvoeren(
      b
        ? supabase().from('matt_artikel_mapping').update(w).eq('id', b.id)
        : supabase().from('matt_artikel_mapping').insert(w),
    ),
  verwijder: (r) => uitvoeren(supabase().from('matt_artikel_mapping').delete().eq('id', r.id)),
};

export function Artikelcodes({ magBewerken }: { magBewerken: boolean }) {
  return <BeheerScherm definitie={mappingDefinitie} magBewerken={magBewerken} />;
}
