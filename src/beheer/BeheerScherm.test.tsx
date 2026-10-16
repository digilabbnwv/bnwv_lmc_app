import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { z } from 'zod';
import { BeheerScherm } from './BeheerScherm';
import { v } from './schema';
import type { BeheerDefinitie } from './types';

type Rij = { id: string; naam: string; uren: number };
const schema = z.object({ naam: v.tekst(50), uren: v.getal({ min: 0 }) });

function definitie(over: Partial<BeheerDefinitie<Rij, z.infer<typeof schema>>> = {}) {
  const opslaan = vi.fn(() => Promise.resolve());
  const verwijder = vi.fn(() => Promise.resolve());
  const d: BeheerDefinitie<Rij, z.infer<typeof schema>> = {
    titel: 'Proefrijen',
    enkelvoud: 'proefrij',
    queryKey: ['proef', Math.random()],
    laad: () =>
      Promise.resolve([
        { id: '1', naam: 'Bèta', uren: 2 },
        { id: '2', naam: 'Alfa', uren: 10 },
      ]),
    sleutel: (r) => r.id,
    rijNaam: (r) => r.naam,
    kolommen: [
      { kop: 'Naam', waarde: (r) => r.naam, sorteer: (r) => r.naam },
      { kop: 'Uren', waarde: (r) => String(r.uren), sorteer: (r) => r.uren, numeriek: true },
    ],
    velden: [
      { naam: 'naam', label: 'Naam', type: 'tekst', verplicht: true },
      { naam: 'uren', label: 'Uren', type: 'getal', verplicht: true },
    ],
    schema,
    leeg: () => ({ naam: '', uren: '' }),
    naarFormulier: (r) => ({ naam: r.naam, uren: String(r.uren) }),
    opslaan,
    verwijder,
    ...over,
  };
  return { d, opslaan, verwijder };
}

function toon(d: BeheerDefinitie<Rij, z.infer<typeof schema>>, magBewerken = true) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <BeheerScherm definitie={d} magBewerken={magBewerken} />
    </QueryClientProvider>,
  );
}

const rijNamen = () =>
  screen
    .getAllByRole('row')
    .slice(1)
    .map((r) => within(r).getAllByRole('cell')[0]?.textContent);

let bevestig: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  bevestig = vi.spyOn(window, 'confirm').mockReturnValue(true);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('BeheerScherm', () => {
  it('toont de rijen en sorteert op een kolom', async () => {
    const { d } = definitie();
    toon(d);
    await screen.findByText('Alfa');
    expect(rijNamen()).toEqual(['Bèta', 'Alfa']);
    fireEvent.click(screen.getByRole('button', { name: 'Naam' }));
    expect(rijNamen()).toEqual(['Alfa', 'Bèta']);
    fireEvent.click(screen.getByRole('button', { name: 'Naam' }));
    expect(rijNamen()).toEqual(['Bèta', 'Alfa']);
  });

  it('zoekt in de rijen', async () => {
    const { d } = definitie();
    toon(d);
    await screen.findByText('Alfa');
    fireEvent.change(screen.getByLabelText('Zoeken'), { target: { value: 'alf' } });
    expect(rijNamen()).toEqual(['Alfa']);
  });

  it('toevoegen: focus op het eerste veld en fouten per veld bij ongeldige invoer', async () => {
    const { d, opslaan } = definitie();
    toon(d);
    await screen.findByText('Alfa');
    fireEvent.click(screen.getByRole('button', { name: 'Proefrij toevoegen' }));
    const naam = screen.getByLabelText(/Naam/);
    expect(document.activeElement).toBe(naam);
    fireEvent.click(screen.getByRole('button', { name: 'Opslaan' }));
    expect(await screen.findByText('Controleer de gemarkeerde velden.')).toBeTruthy();
    expect(naam.getAttribute('aria-invalid')).toBe('true');
    expect(opslaan).not.toHaveBeenCalled();
  });

  it('opslaan geeft de gecontroleerde waarden door', async () => {
    const { d, opslaan } = definitie();
    toon(d);
    await screen.findByText('Alfa');
    fireEvent.click(screen.getByRole('button', { name: 'Proefrij toevoegen' }));
    fireEvent.change(screen.getByLabelText(/Naam/), { target: { value: '  Gamma ' } });
    fireEvent.change(screen.getByLabelText(/Uren/), { target: { value: '2,5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Opslaan' }));
    await waitFor(() => {
      expect(opslaan).toHaveBeenCalledWith({ naam: 'Gamma', uren: 2.5 }, null);
    });
    expect(await screen.findByText('Nieuwe proefrij opgeslagen.')).toBeTruthy();
  });

  it('een databasefout wordt vertaald getoond', async () => {
    const { d } = definitie({
      opslaan: () => Promise.reject(Object.assign(new Error('x'), { code: '23505' })),
    });
    toon(d);
    await screen.findByText('Alfa');
    fireEvent.click(screen.getByRole('button', { name: 'Bewerken: Alfa' }));
    fireEvent.click(screen.getByRole('button', { name: 'Opslaan' }));
    expect(await screen.findByText(/bestaat al/)).toBeTruthy();
  });

  it('verwijderen vraagt om bevestiging', async () => {
    const { d, verwijder } = definitie();
    toon(d);
    await screen.findByText('Alfa');
    fireEvent.click(screen.getByRole('button', { name: 'Bewerken: Alfa' }));
    fireEvent.click(screen.getByRole('button', { name: 'Verwijderen' }));
    expect(bevestig).toHaveBeenCalledWith('Alfa verwijderen?');
    await waitFor(() => {
      expect(verwijder).toHaveBeenCalledWith({ id: '2', naam: 'Alfa', uren: 10 });
    });
  });

  it('alleen inzien: geen toevoegen, opslaan of verwijderen, velden alleen-lezen', async () => {
    const { d } = definitie();
    toon(d, false);
    await screen.findByText('Alfa');
    expect(screen.queryByRole('button', { name: 'Proefrij toevoegen' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Bekijken: Alfa' }));
    expect(screen.queryByRole('button', { name: 'Opslaan' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Verwijderen' })).toBeNull();
    expect(screen.getByLabelText<HTMLInputElement>(/Naam/).readOnly).toBe(true);
  });
});
