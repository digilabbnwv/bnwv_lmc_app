import { describe, expect, it } from 'vitest';
import { instellingSchema, schooljaarSchema, staffelSchema } from './configuratie';
import { contractSchema, medewerkerSchema, nietBeschikbaarSchema } from './medewerkers';
import { foutenPerVeld, v } from './schema';
import { BRON_PER_SOORT, toewijzingSchema } from './toewijzingen';
import { schoolJaarSchema, schoolSchema, staffelurenVoor } from './werk';

describe('bouwstenen', () => {
  it('getal accepteert een komma als decimaalteken', () => {
    expect(v.getal().parse('2,5')).toBe(2.5);
    expect(v.getal().parse('24')).toBe(24);
  });

  it('getal weigert tekst, lege invoer en grenzen', () => {
    expect(v.getal().safeParse('veel').success).toBe(false);
    expect(v.getal().safeParse('').success).toBe(false);
    expect(v.getal({ min: 0 }).safeParse('-1').success).toBe(false);
    expect(v.getal({ geheel: true }).safeParse('1,5').success).toBe(false);
  });

  it('optionele velden worden null bij lege invoer', () => {
    expect(v.optioneelGetal().parse('')).toBeNull();
    expect(v.optioneleTekst().parse('  ')).toBeNull();
    expect(v.optioneleDatum().parse('')).toBeNull();
  });

  it('datumlijst splitst komma-gescheiden ISO-datums', () => {
    expect(v.datumlijst().parse('2026-10-07,2026-11-04,')).toEqual(['2026-10-07', '2026-11-04']);
    expect(v.datumlijst().safeParse('7-10-2026').success).toBe(false);
  });
});

describe('configuratie', () => {
  it('schooljaar: vorm 2026-2027 en einde na start', () => {
    const goed = { naam: '2027-2028', startdatum: '2027-08-01', einddatum: '2028-07-31' };
    expect(schooljaarSchema.safeParse(goed).success).toBe(true);
    expect(schooljaarSchema.safeParse({ ...goed, naam: '27/28' }).success).toBe(false);
    const fout = schooljaarSchema.safeParse({ ...goed, einddatum: '2027-07-31' });
    expect(fout.success).toBe(false);
    if (!fout.success) expect(foutenPerVeld(fout.error).einddatum).toMatch(/na de startdatum/);
  });

  it('staffel: leeg maximum = geen bovengrens; maximum niet onder minimum', () => {
    expect(
      staffelSchema.parse({
        schooltype: 'PO',
        leerlingen_min: '401',
        leerlingen_max: '',
        uren: '70',
      }),
    ).toEqual({ schooltype: 'PO', leerlingen_min: 401, leerlingen_max: null, uren: 70 });
    expect(
      staffelSchema.safeParse({
        schooltype: 'PO',
        leerlingen_min: '200',
        leerlingen_max: '100',
        uren: '1',
      }).success,
    ).toBe(false);
    expect(
      staffelSchema.safeParse({
        schooltype: 'MBO',
        leerlingen_min: '0',
        leerlingen_max: '',
        uren: '1',
      }).success,
    ).toBe(false);
  });

  it('instelling: getal of domeinnaam afhankelijk van de sleutel', () => {
    const basis = { ingangsdatum: '2026-08-01' };
    expect(
      instellingSchema.safeParse({ ...basis, sleutel: 'overhead_percentage', waarde: '15' })
        .success,
    ).toBe(true);
    expect(
      instellingSchema.safeParse({ ...basis, sleutel: 'overhead_percentage', waarde: 'veel' })
        .success,
    ).toBe(false);
    expect(
      instellingSchema.safeParse({
        ...basis,
        sleutel: 'toegestaan_email_domein',
        waarde: 'voorbeeld.nl',
      }).success,
    ).toBe(true);
    expect(
      instellingSchema.safeParse({ ...basis, sleutel: 'toegestaan_email_domein', waarde: 'x@y' })
        .success,
    ).toBe(false);
  });
});

describe('medewerkers', () => {
  it('e-mailadres wordt kleine letters en moet geldig zijn', () => {
    const r = medewerkerSchema.parse({
      voornaam: 'A',
      achternaam: 'B',
      email: 'A.B@Voorbeeld.Test',
      actief: true,
    });
    expect(r.email).toBe('a.b@voorbeeld.test');
    expect(
      medewerkerSchema.safeParse({
        voornaam: 'A',
        achternaam: 'B',
        email: 'geen-adres',
        actief: true,
      }).success,
    ).toBe(false);
  });

  it('contract: max 40 uur, einddatum optioneel en niet voor de begindatum', () => {
    expect(
      contractSchema.parse({ uren_per_week: '24', geldig_van: '2026-08-01', geldig_tot: '' }),
    ).toEqual({
      uren_per_week: 24,
      geldig_van: '2026-08-01',
      geldig_tot: null,
    });
    expect(
      contractSchema.safeParse({ uren_per_week: '41', geldig_van: '2026-08-01', geldig_tot: '' })
        .success,
    ).toBe(false);
    expect(
      contractSchema.safeParse({
        uren_per_week: '24',
        geldig_van: '2026-08-01',
        geldig_tot: '2026-07-31',
      }).success,
    ).toBe(false);
  });

  it('niet beschikbaar: alleen van, tot en een percentage van 0 tot 100', () => {
    expect(
      nietBeschikbaarSchema.safeParse({
        van: '2027-03-01',
        tot: '2027-03-12',
        beschikbaarheidspercentage: '50',
      }).success,
    ).toBe(true);
    expect(
      nietBeschikbaarSchema.safeParse({
        van: '2027-03-01',
        tot: '2027-03-12',
        beschikbaarheidspercentage: '120',
      }).success,
    ).toBe(false);
    // Een extra veld zoals een reden wordt niet doorgegeven.
    const r = nietBeschikbaarSchema.parse({
      van: '2027-03-01',
      tot: '2027-03-12',
      beschikbaarheidspercentage: '0',
      reden: 'ziek',
    });
    expect('reden' in r).toBe(false);
  });
});

describe('werk', () => {
  it('school: postcode wordt hoofdletters en wordt gecontroleerd', () => {
    const basis = {
      naam: 'De Linde',
      vestiging: 'HAR',
      actief: true,
      schooltype: 'PO',
      adres: '',
      plaats: '',
    };
    expect(schoolSchema.parse({ ...basis, postcode: '3841 ab' }).postcode).toBe('3841 AB');
    expect(schoolSchema.parse({ ...basis, postcode: '' }).postcode).toBeNull();
    expect(schoolSchema.safeParse({ ...basis, postcode: '0841 AB' }).success).toBe(false);
  });

  it('leerlingen: handmatige uren vragen een toelichting', () => {
    const basis = { school_id: 'x', aantal_leerlingen: '250' };
    expect(
      schoolJaarSchema.safeParse({ ...basis, uren_handmatig: '', toelichting: '' }).success,
    ).toBe(true);
    expect(
      schoolJaarSchema.safeParse({ ...basis, uren_handmatig: '80', toelichting: '' }).success,
    ).toBe(false);
    expect(
      schoolJaarSchema.safeParse({ ...basis, uren_handmatig: '80', toelichting: 'Afspraak' })
        .success,
    ).toBe(true);
  });

  it('staffelurenVoor zoekt het juiste bereik', () => {
    const staffel = [
      { schooltype: 'PO' as const, leerlingen_min: 0, leerlingen_max: 100, uren: 20 },
      { schooltype: 'PO' as const, leerlingen_min: 101, leerlingen_max: null, uren: 50 },
    ];
    expect(staffelurenVoor('PO', 100, staffel)).toBe(20);
    expect(staffelurenVoor('PO', 101, staffel)).toBe(50);
    expect(staffelurenVoor('PO', 5000, staffel)).toBe(50);
    expect(staffelurenVoor('VO', 50, staffel)).toBeNull();
    expect(staffelurenVoor(null, 50, staffel)).toBeNull();
  });
});

describe('toewijzingen', () => {
  const schooljaar = { startdatum: '2026-08-01', einddatum: '2027-07-31' };
  const soort = (id: string) =>
    id === 'school'
      ? ('school' as const)
      : id === 'activiteit'
        ? ('activiteit' as const)
        : ('project' as const);
  const schema = toewijzingSchema(soort, schooljaar);
  const leeg = {
    medewerker_id: 'm',
    aandeel_percentage: '',
    aantal_keer: '',
    gepland_uitvoering: '',
    gepland_voorbereiding: '',
    gepland_afronding: '',
    verdeling: 'schoolweken',
    looptijd_van: '',
    looptijd_tot: '',
    datums: '',
    toelichting: '',
  };

  it('bron moet passen bij de soort werkpakket', () => {
    expect(BRON_PER_SOORT.project).toEqual(['handmatig']);
    expect(schema.safeParse({ ...leeg, werkpakket_id: 'project', bron: 'staffel' }).success).toBe(
      false,
    );
    expect(schema.safeParse({ ...leeg, werkpakket_id: 'school', bron: 'staffel' }).success).toBe(
      true,
    );
  });

  it('staffel: aandeel standaard 100; andere velden leeg', () => {
    const r = schema.parse({ ...leeg, werkpakket_id: 'school', bron: 'staffel', aantal_keer: '3' });
    expect(r.aandeel_percentage).toBe(100);
    expect(r.aantal_keer).toBeNull();
    expect(r.gepland_uitvoering).toBeNull();
  });

  it('norm × aantal vraagt aantal keer', () => {
    expect(
      schema.safeParse({ ...leeg, werkpakket_id: 'activiteit', bron: 'norm_x_aantal' }).success,
    ).toBe(false);
    const r = schema.parse({
      ...leeg,
      werkpakket_id: 'activiteit',
      bron: 'norm_x_aantal',
      aantal_keer: '20',
    });
    expect(r.aantal_keer).toBe(20);
    expect(r.aandeel_percentage).toBe(100);
  });

  it('handmatig vraagt alle drie de categorieën (0 mag)', () => {
    const basis = { ...leeg, werkpakket_id: 'project', bron: 'handmatig' };
    expect(schema.safeParse({ ...basis, gepland_uitvoering: '10' }).success).toBe(false);
    const r = schema.parse({
      ...basis,
      gepland_uitvoering: '10',
      gepland_voorbereiding: '0',
      gepland_afronding: '2,5',
    });
    expect([r.gepland_uitvoering, r.gepland_voorbereiding, r.gepland_afronding]).toEqual([
      10, 0, 2.5,
    ]);
  });

  it('looptijd: van en tot verplicht en binnen het schooljaar', () => {
    const basis = {
      ...leeg,
      werkpakket_id: 'project',
      bron: 'handmatig',
      gepland_uitvoering: '1',
      gepland_voorbereiding: '0',
      gepland_afronding: '0',
      verdeling: 'looptijd',
    };
    expect(schema.safeParse(basis).success).toBe(false);
    expect(
      schema.safeParse({ ...basis, looptijd_van: '2026-07-01', looptijd_tot: '2026-09-30' })
        .success,
    ).toBe(false);
    const r = schema.parse({ ...basis, looptijd_van: '2026-09-01', looptijd_tot: '2026-09-30' });
    expect(r.looptijd_van).toBe('2026-09-01');
    expect(r.datums).toEqual([]);
  });

  it('op datum: minstens één datum binnen het schooljaar; looptijd wordt leeg', () => {
    const basis = {
      ...leeg,
      werkpakket_id: 'activiteit',
      bron: 'norm_x_aantal',
      aantal_keer: '2',
      verdeling: 'op_datum',
      looptijd_van: '2026-09-01',
    };
    expect(schema.safeParse(basis).success).toBe(false);
    expect(schema.safeParse({ ...basis, datums: '2028-01-01' }).success).toBe(false);
    const r = schema.parse({ ...basis, datums: '2026-10-07,2026-11-04' });
    expect(r.datums).toEqual(['2026-10-07', '2026-11-04']);
    expect(r.looptijd_van).toBeNull();
  });
});
