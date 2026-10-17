// Fictieve gegevens voor de demomodus (alleen development). Namen uit de synthetische
// fixture; e-mailadressen op voorbeeld.test. Geen echte personen of echte MATT-gegevens.

const SJ_OUD = 'demo-sj-2025';
export const SJ = 'demo-sj-2026';

export const MEDEWERKERS = [
  {
    id: 'mw-lotte',
    voornaam: 'Lotte',
    achternaam: 'Visser',
    email: 'lotte.visser@voorbeeld.test',
    actief: true,
  },
  {
    id: 'mw-kees',
    voornaam: 'Kees',
    achternaam: 'van Dijk',
    email: 'kees.vandijk@voorbeeld.test',
    actief: true,
  },
  {
    id: 'mw-fatima',
    voornaam: 'Fatima',
    achternaam: 'el Amrani',
    email: 'fatima.elamrani@voorbeeld.test',
    actief: true,
  },
  {
    id: 'mw-pieter',
    voornaam: 'Pieter',
    achternaam: 'Jansen',
    email: 'pieter.jansen@voorbeeld.test',
    actief: true,
  },
  {
    id: 'mw-sanne',
    voornaam: 'Sanne',
    achternaam: 'de Vries',
    email: 'sanne.devries@voorbeeld.test',
    actief: true,
  },
  {
    id: 'mw-daan',
    voornaam: 'Daan',
    achternaam: 'de Boer',
    email: 'daan.deboer@voorbeeld.test',
    actief: false,
  },
];

/** Contracturen, inzetbaar en gepland per medewerker in schooljaar 2026-2027. */
const BELASTING: [string, number, number, number][] = [
  ['mw-lotte', 24, 904.3909, 640],
  ['mw-kees', 32, 1205.85, 1120],
  ['mw-fatima', 28, 1055.12, 1180.5],
  ['mw-pieter', 16, 602.93, 310],
  ['mw-sanne', 20, 753.66, 690],
];

function zone(graad: number): string {
  if (graad * 100 < 85) return 'ruimte';
  if (graad * 100 <= 100) return 'vol';
  return 'boven_capaciteit';
}

export const BELASTING_SCHOOLJAAR = BELASTING.map(([medewerker_id, uren, inzetbaar, gepland]) => ({
  medewerker_id,
  schooljaar_id: SJ,
  contracturen_per_week: uren,
  inzetbaar,
  gepland,
  ruimte: inzetbaar - gepland,
  belastingsgraad: gepland / inzetbaar,
  zone: zone(gepland / inzetbaar),
}));

/** Verdeling van een jaar over de maanden (aug t/m jul), ongeveer naar werkdagen. */
const MAANDGEWICHT = [0.04, 0.1, 0.09, 0.09, 0.07, 0.09, 0.08, 0.1, 0.08, 0.09, 0.1, 0.07];
const PLANGEWICHT = [0.02, 0.11, 0.1, 0.1, 0.07, 0.1, 0.09, 0.11, 0.08, 0.09, 0.09, 0.04];

export function belastingPerMaand() {
  return BELASTING.flatMap(([medewerker_id, , inzetbaar, gepland]) =>
    MAANDGEWICHT.map((w, i) => {
      const van = new Date(2026, 7 + i, 1);
      const tot = new Date(2026, 8 + i, 0);
      const iso = (d: Date) =>
        `${String(d.getFullYear())}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const inz = inzetbaar * w;
      const gep = gepland * (PLANGEWICHT[i] ?? 0);
      return {
        medewerker_id,
        periode_van: iso(van),
        periode_tot: iso(tot),
        inzetbaar: inz,
        gepland: gep,
        ruimte: inz - gep,
        belastingsgraad: gep / inz,
        zone: zone(gep / inz),
      };
    }),
  );
}

export const TABELLEN: Record<string, Record<string, unknown>[]> = {
  schooljaar: [
    { id: SJ_OUD, naam: '2025-2026', startdatum: '2025-08-01', einddatum: '2026-07-31' },
    { id: SJ, naam: '2026-2027', startdatum: '2026-08-01', einddatum: '2027-07-31' },
  ],
  medewerker: MEDEWERKERS,
  werkpakket: [
    {
      id: 'wp-regenboog',
      soort: 'school',
      naam: 'De Regenboog',
      vestiging: 'HAR',
      actief: true,
      activiteittype_id: null,
    },
    {
      id: 'wp-kompas',
      soort: 'school',
      naam: 'Het Kompas',
      vestiging: 'ERM',
      actief: true,
      activiteittype_id: null,
    },
    {
      id: 'wp-klimboom',
      soort: 'school',
      naam: 'De Klimboom',
      vestiging: 'PUT',
      actief: true,
      activiteittype_id: null,
    },
    {
      id: 'wp-digilab',
      soort: 'activiteit',
      naam: 'Digilab Harderwijk',
      vestiging: 'HAR',
      actief: true,
      activiteittype_id: 'at-digilab',
    },
    {
      id: 'wp-boekjes',
      soort: 'activiteit',
      naam: 'Boekjes & Babbels',
      vestiging: 'NUN',
      actief: true,
      activiteittype_id: 'at-boekjes',
    },
    {
      id: 'wp-leesbevordering',
      soort: 'project',
      naam: 'Leesbevordering VO',
      vestiging: 'overig',
      actief: true,
      activiteittype_id: null,
    },
  ],
  school: [
    {
      werkpakket_id: 'wp-regenboog',
      schooltype: 'PO',
      adres: 'Schoolstraat 1',
      postcode: '3841 AA',
      plaats: 'Harderwijk',
    },
    {
      werkpakket_id: 'wp-kompas',
      schooltype: 'PO',
      adres: 'Dorpsplein 4',
      postcode: '3851 BB',
      plaats: 'Ermelo',
    },
    {
      werkpakket_id: 'wp-klimboom',
      schooltype: 'VO',
      adres: 'Brinkweg 12',
      postcode: '3881 CC',
      plaats: 'Putten',
    },
  ],
  activiteittype: [
    {
      id: 'at-digilab',
      naam: 'Digilab',
      normuren_uitvoering: 2,
      normuren_voorbereiding: 1,
      normuren_afronding: 0.5,
    },
    {
      id: 'at-boekjes',
      naam: 'Boekjes & Babbels',
      normuren_uitvoering: 1,
      normuren_voorbereiding: 0.5,
      normuren_afronding: 0,
    },
  ],
  belasting_schooljaar: BELASTING_SCHOOLJAAR,
  toewijzing: [
    {
      id: 't1',
      medewerker_id: 'mw-lotte',
      werkpakket_id: 'wp-regenboog',
      schooljaar_id: SJ,
      bron: 'staffel',
      aandeel_percentage: 100,
      aantal_keer: null,
      gepland_uitvoering: null,
      gepland_voorbereiding: null,
      gepland_afronding: null,
      verdeling: 'schoolweken',
      looptijd_van: null,
      looptijd_tot: null,
      toelichting: null,
    },
    {
      id: 't2',
      medewerker_id: 'mw-lotte',
      werkpakket_id: 'wp-digilab',
      schooljaar_id: SJ,
      bron: 'norm_x_aantal',
      aandeel_percentage: 100,
      aantal_keer: 40,
      gepland_uitvoering: null,
      gepland_voorbereiding: null,
      gepland_afronding: null,
      verdeling: 'schoolweken',
      looptijd_van: null,
      looptijd_tot: null,
      toelichting: null,
    },
    {
      id: 't3',
      medewerker_id: 'mw-lotte',
      werkpakket_id: 'wp-leesbevordering',
      schooljaar_id: SJ,
      bron: 'handmatig',
      aandeel_percentage: 100,
      aantal_keer: null,
      gepland_uitvoering: 80,
      gepland_voorbereiding: 20,
      gepland_afronding: 10,
      verdeling: 'looptijd',
      looptijd_van: '2026-09-01',
      looptijd_tot: '2027-03-31',
      toelichting: null,
    },
    {
      id: 't4',
      medewerker_id: 'mw-kees',
      werkpakket_id: 'wp-kompas',
      schooljaar_id: SJ,
      bron: 'staffel',
      aandeel_percentage: 100,
      aantal_keer: null,
      gepland_uitvoering: null,
      gepland_voorbereiding: null,
      gepland_afronding: null,
      verdeling: 'schoolweken',
      looptijd_van: null,
      looptijd_tot: null,
      toelichting: null,
    },
  ],
  toewijzing_uren: [
    {
      toewijzing_id: 't1',
      medewerker_id: 'mw-lotte',
      schooljaar_id: SJ,
      werkpakket_id: 'wp-regenboog',
      bron: 'staffel',
      verdeling: 'schoolweken',
      uitvoering: 200,
      voorbereiding: 200,
      afronding: 0,
      totaal: 400,
    },
    {
      toewijzing_id: 't2',
      medewerker_id: 'mw-lotte',
      schooljaar_id: SJ,
      werkpakket_id: 'wp-digilab',
      bron: 'norm_x_aantal',
      verdeling: 'schoolweken',
      uitvoering: 80,
      voorbereiding: 40,
      afronding: 20,
      totaal: 140,
    },
    {
      toewijzing_id: 't3',
      medewerker_id: 'mw-lotte',
      schooljaar_id: SJ,
      werkpakket_id: 'wp-leesbevordering',
      bron: 'handmatig',
      verdeling: 'looptijd',
      uitvoering: 80,
      voorbereiding: 10,
      afronding: 10,
      totaal: 100,
    },
    {
      toewijzing_id: 't4',
      medewerker_id: 'mw-kees',
      schooljaar_id: SJ,
      werkpakket_id: 'wp-kompas',
      bron: 'staffel',
      verdeling: 'schoolweken',
      uitvoering: 150,
      voorbereiding: 150,
      afronding: 0,
      totaal: 300,
    },
  ],
  instelling: [
    { id: 'i1', sleutel: 'overhead_percentage', waarde: '15', ingangsdatum: '2020-01-01' },
    { id: 'i2', sleutel: 'grens_vol', waarde: '85', ingangsdatum: '2020-01-01' },
    { id: 'i3', sleutel: 'grens_boven_capaciteit', waarde: '100', ingangsdatum: '2020-01-01' },
    {
      id: 'i4',
      sleutel: 'toegestaan_email_domein',
      waarde: 'voorbeeld.test',
      ingangsdatum: '2020-01-01',
    },
  ],
  matt_import: [
    {
      id: 'imp3',
      tijdstip: '2026-10-02T09:12:00Z',
      periode_van: '2026-09-01',
      periode_tot: '2026-09-30',
      status: 'definitief',
      totaal_uren: 312.5,
      aantallen: { opgeslagen: { aantal: 148 } },
    },
    {
      id: 'imp2',
      tijdstip: '2026-09-03T10:40:00Z',
      periode_van: '2026-08-01',
      periode_tot: '2026-08-31',
      status: 'definitief',
      totaal_uren: 96,
      aantallen: { opgeslagen: { aantal: 41 } },
    },
    {
      id: 'imp1',
      tijdstip: '2026-09-03T10:31:00Z',
      periode_van: '2026-08-01',
      periode_tot: '2026-08-31',
      status: 'teruggedraaid',
      totaal_uren: 96,
      aantallen: { opgeslagen: { aantal: 41 } },
    },
  ],
  matt_project: [
    {
      id: 'mp1',
      projectnummer: '1001',
      naam_laatst_gezien: 'De Regenboog',
      werkpakket_id: 'wp-regenboog',
      genegeerd: false,
    },
    {
      id: 'mp2',
      projectnummer: '999',
      naam_laatst_gezien: 'Onbekend project',
      werkpakket_id: null,
      genegeerd: false,
    },
  ],
  profiel: [
    { gebruiker_id: 'gb-lotte', medewerker_id: 'mw-lotte' },
    { gebruiker_id: 'gb-kees', medewerker_id: 'mw-kees' },
    { gebruiker_id: 'gb-fatima', medewerker_id: 'mw-fatima' },
  ],
  gebruiker_rol: [
    { gebruiker_id: 'gb-lotte', rol: 'lmc' },
    { gebruiker_id: 'gb-kees', rol: 'coordinator' },
    { gebruiker_id: 'gb-fatima', rol: 'manager' },
  ],
  staffel: [
    { schooljaar_id: SJ, schooltype: 'PO', leerlingen_min: 0, leerlingen_max: 199, uren: 150 },
    { schooljaar_id: SJ, schooltype: 'PO', leerlingen_min: 200, leerlingen_max: null, uren: 200 },
  ],
  opslagfactor: [
    { schooljaar_id: SJ, schooltype: 'PO', factor: 2, bevestigd: false },
    { schooljaar_id: SJ, schooltype: 'VO', factor: 2, bevestigd: false },
  ],
  school_schooljaar: [
    {
      id: 'ss1',
      school_id: 'wp-regenboog',
      schooljaar_id: SJ,
      aantal_leerlingen: 212,
      uren_handmatig: null,
      toelichting: null,
    },
    {
      id: 'ss2',
      school_id: 'wp-kompas',
      schooljaar_id: SJ,
      aantal_leerlingen: 168,
      uren_handmatig: null,
      toelichting: null,
    },
  ],
};

export const RPC: Record<string, (args: Record<string, unknown>) => unknown> = {
  belasting_per_periode: () => belastingPerMaand(),
  gepland_vs_gerealiseerd: () => [
    {
      werkpakket_id: 'wp-regenboog',
      werkpakket_naam: 'De Regenboog',
      categorie: 'uitvoering',
      gepland: 200,
      gepland_tot_peildatum: 52,
      gerealiseerd: 48.5,
      gerealiseerd_tot_peildatum: 48.5,
    },
    {
      werkpakket_id: 'wp-regenboog',
      werkpakket_naam: 'De Regenboog',
      categorie: 'voorbereiding_afronding',
      gepland: 200,
      gepland_tot_peildatum: 52,
      gerealiseerd: 41,
      gerealiseerd_tot_peildatum: 41,
    },
    {
      werkpakket_id: 'wp-digilab',
      werkpakket_naam: 'Digilab Harderwijk',
      categorie: 'uitvoering',
      gepland: 80,
      gepland_tot_peildatum: 20,
      gerealiseerd: 22,
      gerealiseerd_tot_peildatum: 22,
    },
    {
      werkpakket_id: 'wp-digilab',
      werkpakket_naam: 'Digilab Harderwijk',
      categorie: 'voorbereiding_afronding',
      gepland: 60,
      gepland_tot_peildatum: 15,
      gerealiseerd: 12,
      gerealiseerd_tot_peildatum: 12,
    },
    {
      werkpakket_id: null,
      werkpakket_naam: null,
      categorie: 'relatiebeheer',
      gepland: 0,
      gepland_tot_peildatum: 0,
      gerealiseerd: 6.5,
      gerealiseerd_tot_peildatum: 6.5,
    },
    {
      werkpakket_id: null,
      werkpakket_naam: null,
      categorie: 'uitvoering',
      gepland: 0,
      gepland_tot_peildatum: 0,
      gerealiseerd: 4,
      gerealiseerd_tot_peildatum: 4,
    },
  ],
  toewijzing_voorbeeld: () => [
    {
      uitvoering: 200,
      voorbereiding: 200,
      afronding: 0,
      totaal: 400,
      aantal_dagen: 186,
      terugval: false,
    },
  ],
};

export const FUNCTIES: Record<string, () => unknown> = {
  'matt-import': () => ({
    import_id: 'demo-concept',
    bestand: { regels: 156, projecten: 9, eindtotaal: { uren: 330.5 } },
    totaal: { aantal: 156, uren: 330.5 },
    opgeslagen: { aantal: 148, uren: 312.5 },
    medewerkers: [
      { medewerker_id: 'mw-lotte', aantal: 52, uren: 104 },
      { medewerker_id: 'mw-kees', aantal: 48, uren: 110.5 },
      { medewerker_id: 'mw-fatima', aantal: 48, uren: 98 },
    ],
    niet_gematcht: [{ naam: 'Testpersoon Onbekend', aantal: 8, uren: 18 }],
    niet_gematcht_aantal: 8,
    niet_gekoppelde_projecten: [{ projectnummer: '999', naam: 'Onbekend project', uren: 6 }],
    onbekende_artikelcodes: [],
  }),
  // Vast, duidelijk fictief tijdelijk wachtwoord: alleen voor schermafbeeldingen.
  'gebruiker-aanmaken': () => ({
    gebruiker_id: 'demo',
    tijdelijk_wachtwoord: 'Demo-Voorbeeld-Wachtwoord',
  }),
  'account-resetten': () => ({ tijdelijk_wachtwoord: 'Demo-Voorbeeld-Wachtwoord' }),
};
