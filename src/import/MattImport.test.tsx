// Stroom van de MATT-import met nagebootste Edge Function en database (fictieve gegevens).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BevestigingProvider } from '../components/ui/Bevestiging';
import { ToastProvider } from '../components/ui/Toasts';
import { toegankelijkheidsfouten } from '../test/axe';
import type { Voorvertoning } from './logica';
import { MattImport } from './MattImport';

const VOORVERTONING: Voorvertoning = {
  import_id: 'imp1',
  bestand: { regels: 12, projecten: 3, eindtotaal: { uren: 40 } },
  totaal: { aantal: 12, uren: 40 },
  opgeslagen: { aantal: 10, uren: 34.5 },
  medewerkers: [{ medewerker_id: 'mw1', aantal: 10, uren: 34.5 }],
  niet_gematcht: [{ naam: 'Testpersoon Onbekend', aantal: 2, uren: 5.5 }],
  niet_gematcht_aantal: 2,
  niet_gekoppelde_projecten: [{ projectnummer: '999', naam: 'Onbekend project', uren: 3 }],
  onbekende_artikelcodes: [],
};

const nep = vi.hoisted(() => ({
  invoke: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock('../lib/supabase', () => {
  const bouwer = () => {
    const q = {
      select: () => q,
      order: () => q,
      limit: () => q,
      insert: () => Promise.resolve({ error: null }),
      then: (ok: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(ok),
    };
    return q;
  };
  return {
    supabase: () => ({ functions: { invoke: nep.invoke }, rpc: nep.rpc, from: bouwer }),
    functieFout: () => Promise.resolve('fout'),
  };
});

vi.mock('../beheer/data', async (origineel) => ({
  ...(await origineel<typeof import('../beheer/data')>()),
  useMedewerkers: () => ({
    data: [{ id: 'mw1', voornaam: 'Lotte', achternaam: 'Visser', actief: true }],
  }),
  useSchooljaren: () => ({
    data: [{ id: 'sj', naam: '2026-2027', startdatum: '2026-08-01', einddatum: '2027-07-31' }],
  }),
}));

function toon() {
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MemoryRouter>
        <ToastProvider>
          <BevestigingProvider>
            <MattImport />
          </BevestigingProvider>
        </ToastProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const stapKop = () => screen.getByRole('heading', { level: 3, name: /^Stap/ });

async function naarStap2() {
  const invoer = screen.getByLabelText(/MATT-export/);
  const bestand = new File(['<Report/>'], 'export.xml', { type: 'application/xml' });
  fireEvent.change(invoer, { target: { files: [bestand] } });
  fireEvent.click(screen.getByRole('button', { name: 'Vorige maand' }));
  fireEvent.click(screen.getByRole('button', { name: 'Controleren' }));
  await waitFor(() => {
    expect(stapKop().textContent).toBe('Stap 2 van 3: Controle');
  });
}

beforeEach(() => {
  nep.invoke.mockResolvedValue({ data: VOORVERTONING, error: null });
  nep.rpc.mockResolvedValue({ data: null, error: null });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('MATT-import in stappen', () => {
  it('stap 1: bestand, periode met snelkeuze, en controle vooraf', () => {
    toon();
    expect(stapKop().textContent).toBe('Stap 1 van 3: Bestand en periode');
    const stappen = screen.getByRole('list', { name: 'Stappen' });
    expect(within(stappen).getAllByRole('listitem')[0]?.getAttribute('aria-current')).toBe('step');
    fireEvent.click(screen.getByRole('button', { name: 'Controleren' }));
    expect(screen.getByRole('alert').textContent).toContain('Kies een MATT-export');
    expect(nep.invoke).not.toHaveBeenCalled();
  });

  it('snelkeuze "Vorige maand" vult beide datums', () => {
    toon();
    fireEvent.click(screen.getByRole('button', { name: 'Vorige maand' }));
    const van = screen.getByLabelText<HTMLInputElement>('Vanaf').value;
    const tot = screen.getByLabelText<HTMLInputElement>('Tot en met').value;
    expect(van).toMatch(/^\d{4}-\d{2}-01$/);
    expect(tot >= van).toBe(true);
  });

  it('stap 2: kerngetallen, "actie nodig" en de blokken', async () => {
    toon();
    await naarStap2();
    expect(document.activeElement).toBe(stapKop());
    expect(screen.getByText('Er is nog iets van je nodig')).toBeTruthy();
    const alias = screen
      .getByRole('table', { name: 'Namen zonder alias', hidden: true })
      .closest('details');
    expect(alias?.open).toBe(true);
    const medewerkers = screen
      .getByRole('table', { name: 'Gekoppelde medewerkers', hidden: true })
      .closest('details');
    expect(medewerkers?.open).toBe(false);
    const [functie, opties] = nep.invoke.mock.calls[0] as [
      string,
      { headers: Record<string, string> },
    ];
    expect(functie).toBe('matt-import');
    expect(opties.headers['Content-Type']).toBe('application/xml');
  });

  it('definitief maken met bevestiging; stap 3 en opnieuw beginnen', async () => {
    toon();
    await naarStap2();
    fireEvent.click(screen.getByRole('button', { name: 'Definitief maken' }));
    const vraag = await screen.findByRole('dialog', { name: 'Import definitief maken?' });
    await act(async () => {
      fireEvent.click(within(vraag).getByRole('button', { name: 'Definitief maken' }));
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(stapKop().textContent).toBe('Stap 3 van 3: Verwerkt');
    });
    expect(nep.rpc).toHaveBeenCalledWith('matt_import_definitief_maken', { p_import_id: 'imp1' });
    expect(screen.getByText('De import is definitief')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Nieuwe import' }));
    expect(stapKop().textContent).toBe('Stap 1 van 3: Bestand en periode');
  });

  it('heeft geen toegankelijkheidsfouten in stap 1 en 2 (axe)', async () => {
    const { container } = toon();
    expect(await toegankelijkheidsfouten(container)).toEqual([]);
    await naarStap2();
    expect(await toegankelijkheidsfouten(container)).toEqual([]);
  });
});
