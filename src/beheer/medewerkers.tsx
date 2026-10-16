// Medewerkerschermen (SPEC §4, §6): medewerkers, contracten, vakantie-uren,
// beschikbaarheid en aliassen.
import { useId, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { supabase } from '../lib/supabase';
import { formatDatum, formatUren } from '../lib/opmaak';
import { BeheerScherm } from './BeheerScherm';
import { ALIASBRONNEN, naamVan, ophalen, opties, uitvoeren, type AliasBron } from './data';
import { v } from './schema';
import type { BeheerDefinitie } from './types';

type Medewerker = {
  id: string;
  voornaam: string;
  achternaam: string;
  email: string;
  actief: boolean;
};

export const medewerkerSchema = z.object({
  voornaam: v.tekst(100),
  achternaam: v.tekst(100),
  email: v
    .tekst(254)
    .transform((e) => e.toLowerCase())
    .pipe(z.email('Vul een geldig e-mailadres in.')),
  actief: v.vinkje(),
});

function medewerkerDefinitie(
  metLink: boolean,
  filterId?: string,
): BeheerDefinitie<Medewerker, z.infer<typeof medewerkerSchema>> {
  return {
    titel: filterId ? 'Gegevens' : 'Medewerkers',
    enkelvoud: 'medewerker',
    omschrijving: filterId
      ? undefined
      : 'Kies een medewerker voor contracten, vakantie-uren, beschikbaarheid en aliassen.',
    queryKey: filterId ? ['medewerker', filterId] : ['medewerker'],
    laad: () => {
      const q = supabase().from('medewerker').select('id, voornaam, achternaam, email, actief');
      return ophalen(filterId ? q.eq('id', filterId) : q.order('achternaam'));
    },
    sleutel: (r) => r.id,
    rijNaam: (r) => naamVan(r),
    kolommen: [
      {
        kop: 'Naam',
        waarde: (r) =>
          metLink ? <Link to={`/beheer/medewerkers/${r.id}`}>{naamVan(r)}</Link> : naamVan(r),
        sorteer: (r) => `${r.achternaam} ${r.voornaam}`,
      },
      { kop: 'E-mail', waarde: (r) => r.email, sorteer: (r) => r.email },
      {
        kop: 'Status',
        waarde: (r) => (r.actief ? 'Actief' : 'Niet actief'),
        sorteer: (r) => (r.actief ? 0 : 1),
      },
    ],
    velden: [
      { naam: 'voornaam', label: 'Voornaam', type: 'tekst', verplicht: true },
      { naam: 'achternaam', label: 'Achternaam', type: 'tekst', verplicht: true },
      {
        naam: 'email',
        label: 'E-mailadres',
        type: 'tekst',
        verplicht: true,
        hulp: 'Bij een medewerker met account kan het e-mailadres niet worden gewijzigd.',
      },
      {
        naam: 'actief',
        label: 'Actief',
        type: 'vinkje',
        hulp: 'Niet actief trekt de toegang tot de app direct in. Gebruik dit in plaats van verwijderen.',
      },
    ],
    schema: medewerkerSchema,
    leeg: () => ({ voornaam: '', achternaam: '', email: '', actief: true }),
    naarFormulier: (r) => ({
      voornaam: r.voornaam,
      achternaam: r.achternaam,
      email: r.email,
      actief: r.actief,
    }),
    opslaan: (w, b) =>
      uitvoeren(
        b
          ? supabase().from('medewerker').update(w).eq('id', b.id)
          : supabase().from('medewerker').insert(w),
      ),
    verwijder: (r) => uitvoeren(supabase().from('medewerker').delete().eq('id', r.id)),
    ...(filterId ? { kanToevoegen: false } : {}),
    ookVernieuwen: [['medewerker'], ['accounts']],
  };
}

export function Medewerkers({ magBewerken }: { magBewerken: boolean }) {
  const definitie = useMemo(() => medewerkerDefinitie(true), []);
  return <BeheerScherm definitie={definitie} magBewerken={magBewerken} />;
}

// ---------------------------------------------------------------------------
// Onderdelen per medewerker
// ---------------------------------------------------------------------------

type Contract = {
  id: string;
  uren_per_week: number;
  geldig_van: string;
  geldig_tot: string | null;
};
export const contractSchema = z
  .object({
    uren_per_week: v.getal({ min: 0.01, max: 40 }),
    geldig_van: v.datum(),
    geldig_tot: v.optioneleDatum(),
  })
  .refine((c) => c.geldig_tot === null || c.geldig_tot >= c.geldig_van, {
    path: ['geldig_tot'],
    message: 'De einddatum ligt niet voor de begindatum.',
  });

function contractDefinitie(mw: string): BeheerDefinitie<Contract, z.infer<typeof contractSchema>> {
  return {
    titel: 'Contracten',
    enkelvoud: 'contract',
    omschrijving: 'Periodes mogen niet overlappen. Een lege einddatum betekent: doorlopend.',
    queryKey: ['contract', mw],
    laad: () =>
      ophalen(
        supabase()
          .from('contract')
          .select('id, uren_per_week, geldig_van, geldig_tot')
          .eq('medewerker_id', mw)
          .order('geldig_van'),
      ),
    sleutel: (r) => r.id,
    rijNaam: (r) => `Contract vanaf ${formatDatum(r.geldig_van)}`,
    kolommen: [
      {
        kop: 'Uren per week',
        waarde: (r) => formatUren(r.uren_per_week),
        sorteer: (r) => r.uren_per_week,
        numeriek: true,
      },
      { kop: 'Vanaf', waarde: (r) => formatDatum(r.geldig_van), sorteer: (r) => r.geldig_van },
      {
        kop: 'Tot en met',
        waarde: (r) => (r.geldig_tot ? formatDatum(r.geldig_tot) : 'doorlopend'),
        sorteer: (r) => r.geldig_tot ?? '9999',
      },
    ],
    velden: [
      { naam: 'uren_per_week', label: 'Uren per week', type: 'getal', verplicht: true },
      { naam: 'geldig_van', label: 'Geldig vanaf', type: 'datum', verplicht: true },
      { naam: 'geldig_tot', label: 'Geldig tot en met', type: 'datum', hulp: 'Leeg = doorlopend.' },
    ],
    schema: contractSchema,
    leeg: () => ({ uren_per_week: '', geldig_van: '', geldig_tot: '' }),
    naarFormulier: (r) => ({
      uren_per_week: r.uren_per_week.toLocaleString('nl-NL'),
      geldig_van: r.geldig_van,
      geldig_tot: r.geldig_tot ?? '',
    }),
    opslaan: (w, b) =>
      uitvoeren(
        b
          ? supabase().from('contract').update(w).eq('id', b.id)
          : supabase()
              .from('contract')
              .insert({ ...w, medewerker_id: mw }),
      ),
    verwijder: (r) => uitvoeren(supabase().from('contract').delete().eq('id', r.id)),
  };
}

type Vakantie = { id: string; kalenderjaar: number; uren: number };
export const vakantieUrenSchema = z.object({
  kalenderjaar: v.getal({ min: 2000, max: 2100, geheel: true }),
  uren: v.getal({ min: 0 }),
});

function vakantieDefinitie(
  mw: string,
): BeheerDefinitie<Vakantie, z.infer<typeof vakantieUrenSchema>> {
  return {
    titel: 'Vakantie-uren',
    enkelvoud: 'vakantie-uren',
    omschrijving: 'Per kalenderjaar, zoals HR ze levert. De app rekent ze om naar het schooljaar.',
    queryKey: ['vakantie_uren', mw],
    laad: () =>
      ophalen(
        supabase()
          .from('vakantie_uren')
          .select('id, kalenderjaar, uren')
          .eq('medewerker_id', mw)
          .order('kalenderjaar'),
      ),
    sleutel: (r) => r.id,
    rijNaam: (r) => `Vakantie-uren ${String(r.kalenderjaar)}`,
    kolommen: [
      { kop: 'Kalenderjaar', waarde: (r) => r.kalenderjaar, sorteer: (r) => r.kalenderjaar },
      { kop: 'Uren', waarde: (r) => formatUren(r.uren), sorteer: (r) => r.uren, numeriek: true },
    ],
    velden: [
      { naam: 'kalenderjaar', label: 'Kalenderjaar', type: 'getal', verplicht: true },
      { naam: 'uren', label: 'Uren', type: 'getal', verplicht: true },
    ],
    schema: vakantieUrenSchema,
    leeg: () => ({ kalenderjaar: String(new Date().getFullYear()), uren: '' }),
    naarFormulier: (r) => ({
      kalenderjaar: String(r.kalenderjaar),
      uren: r.uren.toLocaleString('nl-NL'),
    }),
    opslaan: (w, b) =>
      uitvoeren(
        b
          ? supabase().from('vakantie_uren').update(w).eq('id', b.id)
          : supabase()
              .from('vakantie_uren')
              .insert({ ...w, medewerker_id: mw }),
      ),
    verwijder: (r) => uitvoeren(supabase().from('vakantie_uren').delete().eq('id', r.id)),
  };
}

type NietBeschikbaar = { id: string; van: string; tot: string; beschikbaarheidspercentage: number };
export const nietBeschikbaarSchema = z
  .object({
    van: v.datum(),
    tot: v.datum(),
    beschikbaarheidspercentage: v.getal({ min: 0, max: 100 }),
  })
  .refine((n) => n.tot >= n.van, {
    path: ['tot'],
    message: 'De einddatum ligt niet voor de begindatum.',
  });

function nietBeschikbaarDefinitie(
  mw: string,
): BeheerDefinitie<NietBeschikbaar, z.infer<typeof nietBeschikbaarSchema>> {
  return {
    titel: 'Beschikbaarheid',
    enkelvoud: 'periode',
    omschrijving: (
      <>
        Periodes waarin iemand minder beschikbaar is. <strong>Leg hier geen reden vast</strong>{' '}
        (geen ziekte, geen soort verlof): alleen het percentage dat iemand beschikbaar is.
      </>
    ),
    queryKey: ['niet_beschikbaar', mw],
    laad: () =>
      ophalen(
        supabase()
          .from('niet_beschikbaar')
          .select('id, van, tot, beschikbaarheidspercentage')
          .eq('medewerker_id', mw)
          .order('van'),
      ),
    sleutel: (r) => r.id,
    rijNaam: (r) => `Periode ${formatDatum(r.van)} – ${formatDatum(r.tot)}`,
    kolommen: [
      { kop: 'Van', waarde: (r) => formatDatum(r.van), sorteer: (r) => r.van },
      { kop: 'Tot en met', waarde: (r) => formatDatum(r.tot), sorteer: (r) => r.tot },
      {
        kop: 'Beschikbaar',
        waarde: (r) => `${r.beschikbaarheidspercentage.toLocaleString('nl-NL')}%`,
        sorteer: (r) => r.beschikbaarheidspercentage,
        numeriek: true,
      },
    ],
    velden: [
      { naam: 'van', label: 'Van', type: 'datum', verplicht: true },
      { naam: 'tot', label: 'Tot en met', type: 'datum', verplicht: true },
      {
        naam: 'beschikbaarheidspercentage',
        label: 'Beschikbaar (%)',
        type: 'getal',
        verplicht: true,
        hulp: '0 = helemaal niet beschikbaar, 50 = de helft van de contracturen.',
      },
    ],
    schema: nietBeschikbaarSchema,
    leeg: () => ({ van: '', tot: '', beschikbaarheidspercentage: '0' }),
    naarFormulier: (r) => ({
      van: r.van,
      tot: r.tot,
      beschikbaarheidspercentage: r.beschikbaarheidspercentage.toLocaleString('nl-NL'),
    }),
    opslaan: (w, b) =>
      uitvoeren(
        b
          ? supabase().from('niet_beschikbaar').update(w).eq('id', b.id)
          : supabase()
              .from('niet_beschikbaar')
              .insert({ ...w, medewerker_id: mw }),
      ),
    verwijder: (r) => uitvoeren(supabase().from('niet_beschikbaar').delete().eq('id', r.id)),
  };
}

type Alias = { id: string; bron: AliasBron; alias: string; alias_genormaliseerd: string | null };
export const aliasSchema = z.object({ bron: v.keuze(ALIASBRONNEN), alias: v.tekst(200) });
const BRONNAAM: Record<AliasBron, string> = { matt: 'MATT', planning: 'Planningsdocument' };

function aliasDefinitie(mw: string): BeheerDefinitie<Alias, z.infer<typeof aliasSchema>> {
  return {
    titel: 'Aliassen',
    enkelvoud: 'alias',
    omschrijving:
      'Hoe de naam in MATT of het planningsdocument staat. Matching negeert hoofdletters en extra spaties.',
    queryKey: ['medewerker_alias', mw],
    laad: () =>
      ophalen(
        supabase()
          .from('medewerker_alias')
          .select('id, bron, alias, alias_genormaliseerd')
          .eq('medewerker_id', mw)
          .order('bron'),
      ),
    sleutel: (r) => r.id,
    rijNaam: (r) => `Alias ${r.alias}`,
    kolommen: [
      { kop: 'Bron', waarde: (r) => BRONNAAM[r.bron], sorteer: (r) => r.bron },
      { kop: 'Alias', waarde: (r) => r.alias, sorteer: (r) => r.alias },
      { kop: 'Wordt gematcht als', waarde: (r) => r.alias_genormaliseerd ?? '' },
    ],
    velden: [
      {
        naam: 'bron',
        label: 'Bron',
        type: 'keuze',
        verplicht: true,
        opties: opties(ALIASBRONNEN, BRONNAAM),
      },
      { naam: 'alias', label: 'Alias', type: 'tekst', verplicht: true },
    ],
    schema: aliasSchema,
    leeg: () => ({ bron: 'matt', alias: '' }),
    naarFormulier: (r) => ({ bron: r.bron, alias: r.alias }),
    opslaan: (w, b) =>
      uitvoeren(
        b
          ? supabase().from('medewerker_alias').update(w).eq('id', b.id)
          : supabase()
              .from('medewerker_alias')
              .insert({ ...w, medewerker_id: mw }),
      ),
    verwijder: (r) => uitvoeren(supabase().from('medewerker_alias').delete().eq('id', r.id)),
  };
}

// ---------------------------------------------------------------------------
// Detailpagina met tabbladen
// ---------------------------------------------------------------------------

const TABBLADEN = ['gegevens', 'contracten', 'vakantie', 'beschikbaarheid', 'aliassen'] as const;
type Tabblad = (typeof TABBLADEN)[number];
const TABNAAM: Record<Tabblad, string> = {
  gegevens: 'Gegevens',
  contracten: 'Contracten',
  vakantie: 'Vakantie-uren',
  beschikbaarheid: 'Beschikbaarheid',
  aliassen: 'Aliassen',
};

export function MedewerkerDetail({ magBewerken }: { magBewerken: boolean }) {
  const { id = '' } = useParams();
  const basis = useId();
  const [tab, setTab] = useState<Tabblad>('gegevens');
  const medewerker = useQuery({
    queryKey: ['medewerker', 'naam', id],
    queryFn: async () => {
      const { data, error } = await supabase()
        .from('medewerker')
        .select('id, voornaam, achternaam')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const definities = useMemo(
    () => ({
      gegevens: medewerkerDefinitie(false, id),
      contracten: contractDefinitie(id),
      vakantie: vakantieDefinitie(id),
      beschikbaarheid: nietBeschikbaarDefinitie(id),
      aliassen: aliasDefinitie(id),
    }),
    [id],
  );

  return (
    <section aria-labelledby={`${basis}-titel`}>
      <p>
        <Link to="/beheer/medewerkers">← Alle medewerkers</Link>
      </p>
      <h2 id={`${basis}-titel`}>{medewerker.data ? naamVan(medewerker.data) : 'Medewerker'}</h2>
      <div role="tablist" aria-label="Onderdelen" className="tabbladen">
        {TABBLADEN.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            id={`${basis}-tab-${t}`}
            aria-selected={tab === t}
            aria-controls={`${basis}-paneel-${t}`}
            tabIndex={tab === t ? 0 : -1}
            className={tab === t ? 'tab actief' : 'tab'}
            onClick={() => {
              setTab(t);
            }}
            onKeyDown={(e) => {
              const i = TABBLADEN.indexOf(t);
              const volgende =
                e.key === 'ArrowRight'
                  ? TABBLADEN[(i + 1) % TABBLADEN.length]
                  : e.key === 'ArrowLeft'
                    ? TABBLADEN[(i + TABBLADEN.length - 1) % TABBLADEN.length]
                    : undefined;
              if (volgende) {
                setTab(volgende);
                document.getElementById(`${basis}-tab-${volgende}`)?.focus();
              }
            }}
          >
            {TABNAAM[t]}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`${basis}-paneel-${tab}`} aria-labelledby={`${basis}-tab-${tab}`}>
        {tab === 'gegevens' ? (
          <BeheerScherm definitie={definities.gegevens} magBewerken={magBewerken} />
        ) : null}
        {tab === 'contracten' ? (
          <BeheerScherm definitie={definities.contracten} magBewerken={magBewerken} />
        ) : null}
        {tab === 'vakantie' ? (
          <BeheerScherm definitie={definities.vakantie} magBewerken={magBewerken} />
        ) : null}
        {tab === 'beschikbaarheid' ? (
          <BeheerScherm definitie={definities.beschikbaarheid} magBewerken={magBewerken} />
        ) : null}
        {tab === 'aliassen' ? (
          <BeheerScherm definitie={definities.aliassen} magBewerken={magBewerken} />
        ) : null}
      </div>
    </section>
  );
}
