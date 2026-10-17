// Accounts: zoeken, aanmaken en resetten in een dialoog, en de wachtwoordstap (fictieve gegevens).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BevestigingProvider } from '../components/ui/Bevestiging';
import { toegankelijkheidsfouten } from '../test/axe';
import { Accounts, filterAccounts, type Rij } from './Accounts';

const WACHTWOORD = 'Voorbeeld-Wachtwoord-123';

const nep = vi.hoisted(() => ({ functie: vi.fn() }));

vi.mock('../lib/supabase', () => {
  const tabellen: Record<string, unknown[]> = {
    medewerker: [
      {
        id: 'mw1',
        voornaam: 'Lotte',
        achternaam: 'Visser',
        email: 'lotte@voorbeeld.test',
        actief: true,
      },
      {
        id: 'mw2',
        voornaam: 'Daan',
        achternaam: 'de Boer',
        email: 'daan@voorbeeld.test',
        actief: true,
      },
      {
        id: 'mw3',
        voornaam: 'Eva',
        achternaam: 'Smit',
        email: 'eva@voorbeeld.test',
        actief: false,
      },
      {
        id: 'mw4',
        voornaam: 'Fatima',
        achternaam: 'el Idrissi',
        email: 'fatima@voorbeeld.test',
        actief: true,
      },
    ],
    profiel: [
      { gebruiker_id: 'gb1', medewerker_id: 'mw1' },
      { gebruiker_id: 'gb4', medewerker_id: 'mw4' },
    ],
    gebruiker_rol: [
      { gebruiker_id: 'gb1', rol: 'lmc' },
      { gebruiker_id: 'gb4', rol: 'manager' },
    ],
  };
  const bouwer = (tabel: string) => {
    const q = {
      select: () => q,
      order: () => q,
      then: (ok: (v: unknown) => unknown) =>
        Promise.resolve({ data: tabellen[tabel] ?? [], error: null }).then(ok),
    };
    return q;
  };
  return { supabase: () => ({ from: bouwer }), roepFunctieAan: nep.functie };
});

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ gebruiker: { id: 'gb4' }, rollen: ['manager'] }),
}));

function toon() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <BevestigingProvider>
        <Accounts />
      </BevestigingProvider>
    </QueryClientProvider>,
  );
}

const rijNamen = () =>
  within(screen.getByRole('table'))
    .getAllByRole('rowheader')
    .map((c) => c.textContent);

const schrijf = vi.fn(() => Promise.resolve());

beforeEach(() => {
  nep.functie.mockResolvedValue({ tijdelijk_wachtwoord: WACHTWOORD });
  Object.assign(navigator, { clipboard: { writeText: schrijf } });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('Accounts: overzicht', () => {
  it('status per medewerker; je kunt je eigen account niet resetten', async () => {
    toon();
    await screen.findByRole('table');
    expect(rijNamen()).toHaveLength(4);
    const eigen = screen.getByRole('button', { name: 'Account van Fatima el Idrissi resetten' });
    expect((eigen as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole('button', { name: /Account aanmaken voor Eva/ })).toBeNull();
  });

  it('zoeken en filteren', async () => {
    toon();
    await screen.findByRole('table');
    fireEvent.change(screen.getByLabelText('Zoeken op naam of e-mail'), {
      target: { value: 'daan@' },
    });
    expect(rijNamen()[0]).toContain('Daan de Boer');
    expect(screen.getByText('1 van 4 medewerkers')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Zoeken op naam of e-mail'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Toon'), { target: { value: 'inactief' } });
    expect(rijNamen()).toHaveLength(1);
  });
});

describe('Accounts: aanmaken en wachtwoordstap', () => {
  async function openAanmaken() {
    toon();
    await screen.findByRole('table');
    fireEvent.click(screen.getByRole('button', { name: 'Account aanmaken voor Daan de Boer' }));
    return screen.getByRole('dialog', { name: 'Account aanmaken voor Daan de Boer' });
  }

  it('aanmaken kan pas met minstens één rol, en geeft de gekozen rollen door', async () => {
    const dialoog = await openAanmaken();
    const knop = within(dialoog).getByRole('button', { name: 'Account aanmaken' });
    expect((knop as HTMLButtonElement).disabled).toBe(true);
    expect(document.activeElement).toBe(within(dialoog).getByLabelText('LMC'));
    fireEvent.click(within(dialoog).getByLabelText('Coördinator'));
    expect((knop as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(knop);
    await screen.findByRole('dialog', { name: 'Tijdelijk wachtwoord voor Daan de Boer' });
    expect(nep.functie).toHaveBeenCalledWith('gebruiker-aanmaken', {
      medewerker_id: 'mw2',
      rollen: ['coordinator'],
    });
  });

  it('wachtwoordstap: kopiëren met bevestiging, sluiten vraagt eerst, daarna is het weg', async () => {
    const dialoog = await openAanmaken();
    fireEvent.click(within(dialoog).getByLabelText('LMC'));
    fireEvent.click(within(dialoog).getByRole('button', { name: 'Account aanmaken' }));
    const stap = await screen.findByRole('dialog', { name: /Tijdelijk wachtwoord/ });
    expect(stap.textContent).toContain(WACHTWOORD);
    expect(document.activeElement).toBe(within(stap).getByRole('button', { name: 'Kopiëren' }));

    await act(async () => {
      fireEvent.click(within(stap).getByRole('button', { name: 'Kopiëren' }));
      await Promise.resolve();
    });
    expect(schrijf).toHaveBeenCalledWith(WACHTWOORD);
    expect(within(stap).getByText('Gekopieerd.')).toBeTruthy();

    // Escape → vraag → Annuleren: wachtwoord blijft staan.
    fireEvent(stap, new Event('cancel', { cancelable: true }));
    const vraag = await screen.findByRole('dialog', { name: 'Wachtwoord sluiten?' });
    await act(async () => {
      fireEvent.click(within(vraag).getByRole('button', { name: 'Annuleren' }));
      await Promise.resolve();
    });
    expect(screen.getByText(WACHTWOORD)).toBeTruthy();

    // "Ik heb het wachtwoord doorgegeven" sluit direct; daarna staat het nergens meer.
    fireEvent.click(screen.getByRole('button', { name: 'Ik heb het wachtwoord doorgegeven' }));
    await waitFor(() => {
      expect(document.body.textContent).not.toContain(WACHTWOORD);
    });
  });

  it('kopiëren zonder klembord: tekst wordt geselecteerd met uitleg', async () => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn(() => Promise.reject(new Error('geen toegang'))) },
    });
    const dialoog = await openAanmaken();
    fireEvent.click(within(dialoog).getByLabelText('LMC'));
    fireEvent.click(within(dialoog).getByRole('button', { name: 'Account aanmaken' }));
    const stap = await screen.findByRole('dialog', { name: /Tijdelijk wachtwoord/ });
    await act(async () => {
      fireEvent.click(within(stap).getByRole('button', { name: 'Kopiëren' }));
      await Promise.resolve();
    });
    expect(await within(stap).findByText(/Ctrl\+C/)).toBeTruthy();
    expect(window.getSelection()?.toString()).toBe(WACHTWOORD);
  });

  it('een fout van de Edge Function staat in de dialoog', async () => {
    nep.functie.mockRejectedValue(new Error('Er bestaat al een gebruiker met dit e-mailadres.'));
    const dialoog = await openAanmaken();
    fireEvent.click(within(dialoog).getByLabelText('LMC'));
    fireEvent.click(within(dialoog).getByRole('button', { name: 'Account aanmaken' }));
    expect((await within(dialoog).findByRole('alert')).textContent).toContain('bestaat al');
  });

  it('resetten vraagt eerst en toont daarna het nieuwe wachtwoord', async () => {
    toon();
    await screen.findByRole('table');
    fireEvent.click(screen.getByRole('button', { name: 'Account van Lotte Visser resetten' }));
    const dialoog = screen.getByRole('dialog', { name: 'Account van Lotte Visser resetten' });
    expect(document.activeElement).toBe(within(dialoog).getByRole('button', { name: 'Annuleren' }));
    fireEvent.click(within(dialoog).getByRole('button', { name: 'Resetten' }));
    expect(await screen.findByText(WACHTWOORD)).toBeTruthy();
    expect(nep.functie).toHaveBeenCalledWith('account-resetten', { gebruiker_id: 'gb1' });
  });

  it('heeft geen toegankelijkheidsfouten (axe)', async () => {
    const { container } = toon();
    await screen.findByRole('table');
    expect(await toegankelijkheidsfouten(container)).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Account aanmaken voor Daan de Boer' }));
    expect(await toegankelijkheidsfouten(container)).toEqual([]);
  });
});

describe('filterAccounts', () => {
  const rij = (naam: string, actief: boolean, gebruikerId: string | null): Rij => ({
    medewerkerId: naam,
    naam,
    email: `${naam}@voorbeeld.test`,
    actief,
    gebruikerId,
    rollen: [],
  });
  const lijst = [rij('a', true, 'g'), rij('b', true, null), rij('c', false, null)];

  it('met, zonder en niet actief', () => {
    expect(filterAccounts(lijst, '', 'met').map((r) => r.naam)).toEqual(['a']);
    expect(filterAccounts(lijst, '', 'zonder').map((r) => r.naam)).toEqual(['b']);
    expect(filterAccounts(lijst, '', 'inactief').map((r) => r.naam)).toEqual(['c']);
    expect(filterAccounts(lijst, 'B@VOOR', 'alle').map((r) => r.naam)).toEqual(['b']);
  });
});
