// Overzichten met nagebootste (fictieve) gegevens: inhoud, gedrag en toegankelijkheid.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Rol } from '../auth/AuthContext';
import { toegankelijkheidsfouten } from '../test/axe';
import { GeplandGerealiseerd } from './GeplandGerealiseerd';
import { MaandGrafiek } from './MaandGrafiek';
import { MijnBelasting } from './MijnBelasting';
import { Teamoverzicht } from './Teamoverzicht';

const MW = { lotte: 'mw-lotte', daan: 'mw-daan', eva: 'mw-eva' };

const TABELLEN: Record<string, unknown[]> = {
  belasting_schooljaar: [
    {
      medewerker_id: MW.lotte,
      contracturen_per_week: 24,
      inzetbaar: 904.3909,
      gepland: 600,
      ruimte: 304.3909,
      belastingsgraad: 0.6634,
      zone: 'ruimte',
    },
    {
      medewerker_id: MW.daan,
      contracturen_per_week: 32,
      inzetbaar: 1200,
      gepland: 1100,
      ruimte: 100,
      belastingsgraad: 0.9167,
      zone: 'vol',
    },
    {
      medewerker_id: MW.eva,
      contracturen_per_week: 16,
      inzetbaar: 600,
      gepland: 690,
      ruimte: -90,
      belastingsgraad: 1.15,
      zone: 'boven_capaciteit',
    },
  ],
  toewijzing_uren: [
    {
      toewijzing_id: 't1',
      werkpakket_id: 'wp1',
      bron: 'staffel',
      verdeling: 'schoolweken',
      totaal: 100,
    },
  ],
  toewijzing: [{ id: 't1', looptijd_van: null, looptijd_tot: null }],
  instelling: [
    { sleutel: 'grens_vol', waarde: '85', ingangsdatum: '2020-01-01' },
    { sleutel: 'grens_boven_capaciteit', waarde: '100', ingangsdatum: '2020-01-01' },
  ],
};

const RPC: Record<string, unknown[]> = {
  belasting_per_periode: [
    {
      medewerker_id: MW.lotte,
      periode_van: '2026-08-01',
      inzetbaar: 40,
      gepland: 20,
      belastingsgraad: 0.5,
      zone: 'ruimte',
    },
    {
      medewerker_id: MW.lotte,
      periode_van: '2026-09-01',
      inzetbaar: 80,
      gepland: 75,
      belastingsgraad: 0.94,
      zone: 'vol',
    },
    {
      medewerker_id: MW.lotte,
      periode_van: '2026-10-01',
      inzetbaar: 70,
      gepland: 84,
      belastingsgraad: 1.2,
      zone: 'boven_capaciteit',
    },
  ],
  gepland_vs_gerealiseerd: [
    {
      werkpakket_id: 'wp1',
      werkpakket_naam: 'De Regenboog',
      categorie: 'uitvoering',
      gepland: 50,
      gepland_tot_peildatum: 10,
      gerealiseerd: 8,
      gerealiseerd_tot_peildatum: 8,
    },
    {
      werkpakket_id: 'wp1',
      werkpakket_naam: 'De Regenboog',
      categorie: 'voorbereiding_afronding',
      gepland: 50,
      gepland_tot_peildatum: 10,
      gerealiseerd: 12,
      gerealiseerd_tot_peildatum: 12,
    },
    {
      werkpakket_id: null,
      werkpakket_naam: null,
      categorie: 'uitvoering',
      gepland: 0,
      gepland_tot_peildatum: 0,
      gerealiseerd: 3.5,
      gerealiseerd_tot_peildatum: 3.5,
    },
  ],
};

function bouwer(rijen: unknown[]) {
  const q = {
    select: () => q,
    eq: () => q,
    in: () => q,
    order: () => q,
    maybeSingle: () => Promise.resolve({ data: rijen[0] ?? null, error: null }),
    then: (ok: (v: unknown) => unknown, fout?: (e: unknown) => unknown) =>
      Promise.resolve({ data: rijen, error: null }).then(ok, fout),
  };
  return q;
}

vi.mock('../lib/supabase', () => ({
  supabase: () => ({
    from: (tabel: string) => bouwer(TABELLEN[tabel] ?? []),
    rpc: (naam: string) => Promise.resolve({ data: RPC[naam] ?? [], error: null }),
  }),
}));

const nep = vi.hoisted(() => ({ rollen: [] as Rol[], medewerkerId: null as string | null }));
vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ rollen: nep.rollen, medewerkerId: nep.medewerkerId }),
}));

vi.mock('../beheer/data', async (origineel) => ({
  ...(await origineel<typeof import('../beheer/data')>()),
  useSchooljaren: () => ({
    data: [{ id: 'sj', naam: '2026-2027', startdatum: '2026-08-01', einddatum: '2027-07-31' }],
  }),
  useMedewerkers: () => ({
    data: [
      { id: MW.lotte, voornaam: 'Lotte', achternaam: 'Visser', actief: true },
      { id: MW.daan, voornaam: 'Daan', achternaam: 'de Boer', actief: true },
      { id: MW.eva, voornaam: 'Eva', achternaam: 'Smit', actief: true },
    ],
  }),
  useWerkpakketten: () => ({ data: [{ id: 'wp1', naam: 'De Regenboog' }] }),
}));

function toon(element: React.ReactNode, pad = '/', route = '*') {
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MemoryRouter initialEntries={[pad]}>
        <Routes>
          <Route path={route} element={element} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  nep.rollen = ['lmc'];
  nep.medewerkerId = MW.lotte;
});
afterEach(cleanup);

describe('Mijn belasting', () => {
  it('kerngetallen met eenheid en uitleg', async () => {
    toon(<MijnBelasting />);
    const lijst = await screen.findByText('904,4');
    expect(lijst).toBeTruthy();
    expect(screen.getAllByText('Hoe wordt dit berekend?')).toHaveLength(4);
    for (const label of ['Inzetbaar', 'Gepland', 'Gerealiseerd (MATT)', 'Resterende ruimte']) {
      expect(screen.getByText(label, { selector: 'dt' })).toBeTruthy();
    }
  });

  it('zonelegenda met de grenzen uit de instellingen', async () => {
    toon(<MijnBelasting />);
    expect(await screen.findByText(/onder 85%/)).toBeTruthy();
    expect(screen.getByText(/85% tot en met 100%/)).toBeTruthy();
    expect(screen.getByText(/boven 100%/)).toBeTruthy();
  });

  it('per maand een grafiek met tekstalternatief en een tabel', async () => {
    toon(<MijnBelasting />);
    const grafiek = await screen.findByRole('img', { name: /Inzetbaar en gepland per maand/ });
    expect(grafiek.textContent).toContain('Het meeste gepland: oktober 2026, 84,0 uur');
    expect(screen.getByText('Als tabel tonen')).toBeTruthy();
    expect(screen.getByRole('rowheader', { name: 'september 2026' })).toBeTruthy();
  });

  it('melding als het account niet aan een medewerker is gekoppeld', () => {
    nep.medewerkerId = null;
    toon(<MijnBelasting />);
    expect(screen.getByRole('status').textContent).toContain('niet aan een medewerker gekoppeld');
  });

  it('heeft geen toegankelijkheidsfouten (axe)', async () => {
    const { container } = toon(<MijnBelasting />);
    await screen.findByText('904,4');
    await screen.findByRole('img', { name: /per maand/ });
    expect(await toegankelijkheidsfouten(container)).toEqual([]);
  });
});

describe('Teamoverzicht', () => {
  beforeEach(() => {
    nep.rollen = ['coordinator'];
  });

  const tabelNamen = () =>
    within(screen.getByRole('table'))
      .getAllByRole('rowheader')
      .map((c) => c.textContent);

  it('standaard op resterende ruimte, van veel naar weinig, met totaalrij', async () => {
    toon(<Teamoverzicht />);
    await screen.findByRole('table');
    expect(tabelNamen()).toEqual([
      'Lotte Visser',
      'Daan de Boer',
      'Eva Smit',
      'Totaal (3 medewerkers)',
    ]);
    const totaal = screen.getByRole('row', { name: /Totaal/ });
    expect(totaal.textContent).toContain('2.704,4');
    expect(screen.getByText('3 medewerkers', { selector: '.telling' })).toBeTruthy();
  });

  it('zoeken en zonefilter, met telling en "Filters wissen"', async () => {
    toon(<Teamoverzicht />);
    await screen.findByRole('table');
    fireEvent.change(screen.getByLabelText('Zoeken op naam'), { target: { value: 'eva' } });
    expect(tabelNamen()).toEqual(['Eva Smit', 'Totaal (1 medewerker)']);
    expect(screen.getByText('1 van 3 medewerkers')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Zone'), { target: { value: 'vol' } });
    expect(screen.queryByRole('table')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Filters wissen' }));
    expect(tabelNamen()).toHaveLength(4);
  });

  it('de kaarten (smal scherm) tonen dezelfde medewerkers als de tabel', async () => {
    toon(<Teamoverzicht />);
    await screen.findByRole('table');
    const kaarten = screen.getByRole('list', { name: 'Teamoverzicht' });
    const namen = within(kaarten)
      .getAllByRole('heading')
      .map((h) => h.textContent);
    expect(namen).toEqual(tabelNamen());
  });

  it('heeft geen toegankelijkheidsfouten (axe)', async () => {
    const { container } = toon(<Teamoverzicht />);
    await screen.findByRole('table');
    expect(await toegankelijkheidsfouten(container)).toEqual([]);
  });
});

describe('Gepland en gerealiseerd', () => {
  it('per categorie een kaart; tot vandaag alleen in cijfers', async () => {
    toon(<GeplandGerealiseerd />);
    const kaart = await screen.findByRole('region', { name: 'Uitvoering' });
    expect(kaart.textContent).toContain('Tot vandaag: 11,5 uur geboekt, 10,0 uur gepland.');
    expect(screen.getByRole('region', { name: 'Relatiebeheer' }).textContent).toContain(
      'niet vooraf gepland',
    );
  });

  it('niet-gekoppelde uren als melding', async () => {
    toon(<GeplandGerealiseerd />);
    const melding = await screen.findByText('Niet gekoppeld');
    expect(melding.closest('[role="status"]')?.textContent).toContain('3,5 uur');
  });

  it('vanuit het teamoverzicht: kruimelpad terug', async () => {
    nep.rollen = ['coordinator'];
    toon(
      <GeplandGerealiseerd />,
      `/gepland-gerealiseerd/${MW.daan}`,
      '/gepland-gerealiseerd/:medewerkerId',
    );
    const pad = await screen.findByRole('navigation', { name: 'Kruimelpad' });
    expect(within(pad).getByRole('link', { name: 'Teamoverzicht' })).toBeTruthy();
    expect(pad.textContent).toContain('Daan de Boer');
  });

  it('heeft geen toegankelijkheidsfouten (axe)', async () => {
    const { container } = toon(<GeplandGerealiseerd />);
    await screen.findByRole('region', { name: 'Uitvoering' });
    expect(await toegankelijkheidsfouten(container)).toEqual([]);
  });
});

describe('MaandGrafiek', () => {
  const rij = (maand: string, inzetbaar: number, gepland: number, zone: string) => ({
    periode_van: `2026-${maand}-01`,
    inzetbaar,
    gepland,
    belastingsgraad: gepland / inzetbaar,
    zone,
  });

  it('twee staven per maand; boven capaciteit gearceerd; tooltip per maand', () => {
    const { container } = render(
      <MaandGrafiek rijen={[rij('09', 80, 40, 'ruimte'), rij('10', 50, 60, 'boven_capaciteit')]} />,
    );
    expect(container.querySelectorAll('.grafiek-inzetbaar')).toHaveLength(2);
    expect(container.querySelectorAll('.grafiek-gepland')).toHaveLength(1);
    expect(container.querySelector('path[fill^="url(#"]')).toBeTruthy();
    const titels = [...container.querySelectorAll('g.grafiek-groep > title')].map(
      (t) => t.textContent,
    );
    expect(titels[1]).toBe(
      'oktober 2026: inzetbaar 50,0 uur, gepland 60,0 uur (120% · Boven capaciteit)',
    );
  });

  it('de hoogste staaf blijft binnen het tekenvlak', () => {
    const { container } = render(<MaandGrafiek rijen={[rij('09', 104, 30, 'ruimte')]} />);
    const pad = container.querySelector('.grafiek-inzetbaar')?.getAttribute('d') ?? '';
    const ys = [...pad.matchAll(/[VQ,\s](\d+(?:\.\d+)?)/g)].map((m) => Number(m[1]));
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(24);
  });
});
