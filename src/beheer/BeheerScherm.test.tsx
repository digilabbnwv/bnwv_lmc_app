import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { z } from 'zod';
import { BevestigingProvider } from '../components/ui/Bevestiging';
import { ToastProvider } from '../components/ui/Toasts';
import { toegankelijkheidsfouten } from '../test/axe';
import { ALLEEN_INZIEN, BeheerScherm, groeperen, kleineBeginletter } from './BeheerScherm';
import { v } from './schema';
import type { BeheerDefinitie } from './types';

type Rij = { id: string; naam: string; uren: number };
const schema = z.object({ naam: v.tekst(50), uren: v.getal({ min: 0 }) });
const RIJEN: Rij[] = [
  { id: '1', naam: 'Bèta', uren: 2 },
  { id: '2', naam: 'Alfa', uren: 10 },
];

function definitie(over: Partial<BeheerDefinitie<Rij, z.infer<typeof schema>>> = {}) {
  const opslaan = vi.fn(() => Promise.resolve());
  const verwijder = vi.fn(() => Promise.resolve());
  const d: BeheerDefinitie<Rij, z.infer<typeof schema>> = {
    titel: 'Proefrijen',
    enkelvoud: 'proefrij',
    queryKey: ['proef', Math.random()],
    laad: () => Promise.resolve(RIJEN),
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
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <ToastProvider>
        <BevestigingProvider>
          <BeheerScherm definitie={d} magBewerken={magBewerken} />
        </BevestigingProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

const rijNamen = () =>
  within(screen.getByRole('table'))
    .getAllByRole('row')
    .slice(1)
    .map((r) => within(r).getAllByRole('cell')[0]?.textContent);

const paneel = () => screen.getByRole('dialog', { name: /proefrij|Alfa|Bèta/i });

/** Klikt in de bevestigingsdialoog (de bovenste dialoog). */
async function bevestigMet(knop: string) {
  const dialoog = await screen.findByRole('dialog', { name: /verwijderen\?|weggooien\?/ });
  await act(async () => {
    fireEvent.click(within(dialoog).getByRole('button', { name: knop }));
    await Promise.resolve();
  });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('BeheerScherm: overzicht', () => {
  it('toont de rijen met telling en sorteert op een kolom', async () => {
    const { d } = definitie();
    toon(d);
    await screen.findByText('Alfa');
    expect(screen.getByText('2 proefrijen')).toBeTruthy();
    expect(rijNamen()).toEqual(['Bèta', 'Alfa']);
    fireEvent.click(screen.getByRole('button', { name: 'Naam' }));
    expect(rijNamen()).toEqual(['Alfa', 'Bèta']);
    fireEvent.click(screen.getByRole('button', { name: 'Naam' }));
    expect(rijNamen()).toEqual(['Bèta', 'Alfa']);
  });

  it('zoekt in de rijen, met telling en een lege staat', async () => {
    const { d } = definitie();
    toon(d);
    await screen.findByText('Alfa');
    fireEvent.change(screen.getByLabelText('Zoeken'), { target: { value: 'alf' } });
    expect(rijNamen()).toEqual(['Alfa']);
    expect(screen.getByText('1 van 2 proefrijen')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Zoeken'), { target: { value: 'zzz' } });
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.getByText('Geen resultaten voor "zzz"')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Zoekterm wissen' }));
    expect(rijNamen()).toHaveLength(2);
    expect(document.activeElement).toBe(screen.getByLabelText('Zoeken'));
  });

  it('zonder gegevens: lege staat met een knop om toe te voegen', async () => {
    const { d } = definitie({ laad: () => Promise.resolve([]) });
    toon(d);
    expect(await screen.findByText('Nog geen proefrijen')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Proefrij toevoegen' })).toHaveLength(2);
  });
});

describe('BeheerScherm: zijpaneel', () => {
  it('toevoegen opent het paneel met de focus op het eerste veld', async () => {
    const { d } = definitie();
    toon(d);
    await screen.findByText('Alfa');
    fireEvent.click(screen.getByRole('button', { name: 'Proefrij toevoegen' }));
    expect(screen.getByRole('dialog', { name: 'Nieuwe proefrij' })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByLabelText(/Naam/));
  });

  it('ongeldige invoer: foutoverzicht krijgt de focus en springt naar het veld', async () => {
    const { d, opslaan } = definitie();
    toon(d);
    await screen.findByText('Alfa');
    fireEvent.click(screen.getByRole('button', { name: 'Proefrij toevoegen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Opslaan' }));
    const melding = await screen.findByRole('alert');
    expect(melding.textContent).toContain('Controleer de velden');
    expect(melding.parentElement).toBe(document.activeElement);
    const naam = screen.getByLabelText(/Naam/);
    expect(naam.getAttribute('aria-invalid')).toBe('true');
    fireEvent.click(within(melding).getByRole('button', { name: /^Naam:/ }));
    expect(document.activeElement).toBe(naam);
    expect(opslaan).not.toHaveBeenCalled();
  });

  it('opslaan geeft de gecontroleerde waarden door, sluit het paneel en toont een toast', async () => {
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
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('een databasefout wordt vertaald getoond in het paneel', async () => {
    const { d } = definitie({
      opslaan: () => Promise.reject(Object.assign(new Error('x'), { code: '23505' })),
    });
    toon(d);
    await screen.findByText('Alfa');
    fireEvent.click(screen.getByRole('button', { name: 'Bewerken: Alfa' }));
    fireEvent.click(screen.getByRole('button', { name: 'Opslaan' }));
    const melding = await within(paneel()).findByRole('alert');
    expect(melding.textContent).toMatch(/bestaat al/);
  });

  it('sluiten zonder wijzigingen vraagt niets; de focus gaat terug naar de knop', async () => {
    const { d } = definitie();
    toon(d);
    await screen.findByText('Alfa');
    const knop = screen.getByRole('button', { name: 'Bewerken: Alfa' });
    knop.focus();
    fireEvent.click(knop);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Annuleren' }));
      await Promise.resolve();
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(knop);
  });

  it('sluiten met wijzigingen vraagt eerst of ze weg mogen', async () => {
    const { d } = definitie();
    toon(d);
    await screen.findByText('Alfa');
    fireEvent.click(screen.getByRole('button', { name: 'Bewerken: Alfa' }));
    fireEvent.change(screen.getByLabelText(/Naam/), { target: { value: 'Alfa 2' } });

    // Escape (cancel) → vraag → Annuleren: paneel blijft open, wijziging blijft staan.
    fireEvent(paneel(), new Event('cancel', { cancelable: true }));
    await bevestigMet('Annuleren');
    expect(screen.getByLabelText<HTMLInputElement>(/Naam/).value).toBe('Alfa 2');

    // Sluiten → vraag → Weggooien: paneel dicht.
    fireEvent.click(within(paneel()).getByRole('button', { name: 'Annuleren' }));
    await bevestigMet('Weggooien');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('verwijderen vraagt om bevestiging en toont een toast', async () => {
    const { d, verwijder } = definitie();
    toon(d);
    await screen.findByText('Alfa');
    fireEvent.click(screen.getByRole('button', { name: 'Bewerken: Alfa' }));
    fireEvent.click(screen.getByRole('button', { name: 'Verwijderen' }));
    const vraag = await screen.findByRole('dialog', { name: 'Proefrij verwijderen?' });
    expect(vraag.textContent).toContain('Alfa wordt verwijderd.');
    await bevestigMet('Verwijderen');
    await waitFor(() => {
      expect(verwijder).toHaveBeenCalledWith({ id: '2', naam: 'Alfa', uren: 10 });
    });
    expect(await screen.findByText('Alfa is verwijderd.')).toBeTruthy();
  });

  it('verwijderen annuleren verwijdert niets', async () => {
    const { d, verwijder } = definitie();
    toon(d);
    await screen.findByText('Alfa');
    fireEvent.click(screen.getByRole('button', { name: 'Bewerken: Alfa' }));
    fireEvent.click(screen.getByRole('button', { name: 'Verwijderen' }));
    await bevestigMet('Annuleren');
    expect(verwijder).not.toHaveBeenCalled();
    expect(paneel()).toBeTruthy();
  });
});

describe('BeheerScherm: alleen inzien', () => {
  it('uitleg in beeld; geen toevoegen, opslaan of verwijderen; velden alleen-lezen', async () => {
    const { d } = definitie();
    toon(d, false);
    await screen.findByText('Alfa');
    expect(screen.getByRole('status').textContent).toContain(ALLEEN_INZIEN);
    expect(screen.queryByRole('button', { name: 'Proefrij toevoegen' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Bekijken: Alfa' }));
    expect(within(paneel()).getByText(ALLEEN_INZIEN)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Opslaan' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Verwijderen' })).toBeNull();
    expect(screen.getByLabelText<HTMLInputElement>(/Naam/).readOnly).toBe(true);
    // Sluiten vraagt niets: er kan niets gewijzigd zijn.
    await act(async () => {
      // Zowel ✕ als de knop onderaan heten Sluiten en doen hetzelfde.
      const [, onderaan] = within(paneel()).getAllByRole('button', { name: 'Sluiten' });
      if (onderaan) fireEvent.click(onderaan);
      await Promise.resolve();
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('BeheerScherm: toegankelijkheid (axe)', () => {
  it('lijst, paneel nieuw en paneel bekijken', async () => {
    const { d } = definitie();
    const { container, unmount } = toon(d);
    await screen.findByText('Alfa');
    expect(await toegankelijkheidsfouten(container)).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Proefrij toevoegen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Opslaan' }));
    await screen.findByRole('alert');
    expect(await toegankelijkheidsfouten(container)).toEqual([]);
    unmount();

    const alleenLezen = toon(definitie().d, false);
    await screen.findByText('Alfa');
    fireEvent.click(screen.getByRole('button', { name: 'Bekijken: Alfa' }));
    expect(await toegankelijkheidsfouten(alleenLezen.container)).toEqual([]);
  });
});

describe('kleineBeginletter', () => {
  it('maakt alleen gewone woorden klein', () => {
    expect(kleineBeginletter('Scholen')).toBe('scholen');
    expect(kleineBeginletter('MATT-artikelcodes')).toBe('MATT-artikelcodes');
  });
});

describe('BeheerScherm: formulier in blokken en samenvatting', () => {
  it('velden met een groep staan in een fieldset met legenda; samenvatting onder het formulier', async () => {
    const { d } = definitie({
      velden: [
        { naam: 'naam', label: 'Naam', type: 'tekst', verplicht: true, groep: 'Wie en wat' },
        { naam: 'uren', label: 'Uren', type: 'getal', verplicht: true, groep: 'Uren' },
      ],
      samenvatting: (w) => <p>Samenvatting: {String(w.naam)}</p>,
    });
    toon(d);
    await screen.findByText('Alfa');
    fireEvent.click(screen.getByRole('button', { name: 'Bewerken: Alfa' }));
    const groep = screen.getByRole('group', { name: 'Wie en wat' });
    expect(within(groep).getByLabelText(/Naam/)).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Uren' })).toBeTruthy();
    expect(within(paneel()).getByText('Samenvatting: Alfa')).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/Naam/), { target: { value: 'Gamma' } });
    expect(within(paneel()).getByText('Samenvatting: Gamma')).toBeTruthy();
  });
});

describe('groeperen', () => {
  it('voegt opeenvolgende velden van dezelfde groep samen', () => {
    const veld = (naam: string, groep?: string) =>
      ({ naam, label: naam, type: 'tekst', ...(groep ? { groep } : {}) }) as const;
    const blokken = groeperen([veld('a', 'X'), veld('b', 'X'), veld('c'), veld('d', 'Y')]);
    expect(blokken.map((b) => [b.groep, b.velden.map((v) => v.naam)])).toEqual([
      ['X', ['a', 'b']],
      [undefined, ['c']],
      ['Y', ['d']],
    ]);
  });
});
