import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { toewijzingSchema, UrenVoorbeeld, verdelingZin } from './toewijzingen';

const nep = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('../lib/supabase', () => ({ supabase: () => ({ rpc: nep.rpc }) }));

afterEach(() => {
  cleanup();
  nep.rpc.mockReset();
});

const SCHOOLJAAR = { startdatum: '2026-08-01', einddatum: '2027-07-31' };
const schema = toewijzingSchema(() => 'school', SCHOOLJAAR);
const geldig = {
  medewerker_id: 'mw1',
  werkpakket_id: 'wp1',
  bron: 'staffel',
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
};

function toon(waarden: Record<string, string>, bestaandId: string | null = null) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <UrenVoorbeeld waarden={waarden} bestaandId={bestaandId} schema={schema} schooljaarId="sj" />
    </QueryClientProvider>,
  );
}

describe('UrenVoorbeeld', () => {
  it('vraagt om gegevens zolang het formulier onvolledig is (en roept de database niet aan)', async () => {
    toon({ ...geldig, werkpakket_id: '' });
    expect(screen.getByRole('status').textContent).toContain('Vul de gegevens in');
    await new Promise((r) => setTimeout(r, 450));
    expect(nep.rpc).not.toHaveBeenCalled();
  });

  it('toont de uren en de verdeling uit de database', async () => {
    nep.rpc.mockResolvedValue({
      data: [
        {
          uitvoering: 50,
          voorbereiding: 50,
          afronding: 0,
          totaal: 100,
          aantal_dagen: 186,
          terugval: false,
        },
      ],
      error: null,
    });
    toon(geldig, 't1');
    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toContain(
        '≈ 100,0 uur, verdeeld over 186 schoolweekdagen.',
      );
    });
    expect(nep.rpc).toHaveBeenCalledWith(
      'toewijzing_voorbeeld',
      expect.objectContaining({
        p_toewijzing_id: 't1',
        p_bron: 'staffel',
        p_aandeel_percentage: 100,
        p_aantal_keer: null,
        p_verdeling: 'schoolweken',
        p_datums: [],
        p_schooljaar_id: 'sj',
      }),
    );
  });

  it('meldt een terugval op de eerste dag', async () => {
    nep.rpc.mockResolvedValue({
      data: [
        {
          uitvoering: 3,
          voorbereiding: 0,
          afronding: 0,
          totaal: 3,
          aantal_dagen: 0,
          terugval: true,
        },
      ],
      error: null,
    });
    toon(geldig);
    expect(await screen.findByText(/geen geschikte dagen/)).toBeTruthy();
  });

  it('een databasefout wordt vertaald getoond', async () => {
    nep.rpc.mockResolvedValue({ data: null, error: { code: '23505', message: 'duplicate' } });
    toon(geldig);
    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toMatch(/bestaat al/);
    });
  });
});

describe('verdelingZin', () => {
  it('benoemt de verdeling met het aantal dagen', () => {
    expect(verdelingZin('schoolweken', 186)).toBe('verdeeld over 186 schoolweekdagen');
    expect(verdelingZin('looptijd', 10)).toBe('verdeeld over 10 werkdagen in de looptijd');
    expect(verdelingZin('op_datum', 1)).toBe('verdeeld over 1 datum');
    expect(verdelingZin('op_datum', 3)).toBe('verdeeld over 3 datums');
  });
});
