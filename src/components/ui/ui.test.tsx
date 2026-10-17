import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { toegankelijkheidsfouten } from '../../test/axe';
import { BevestigingProvider, useBevestig } from './Bevestiging';
import { Dialoog } from './Dialoog';
import { Knop } from './Knop';
import { Melding } from './Melding';
import { TOAST_DUUR, ToastProvider, useToast } from './Toasts';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function DialoogProef() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
        }}
      >
        Openen
      </button>
      <Dialoog
        open={open}
        titel="School bewerken"
        opSluiten={() => {
          setOpen(false);
        }}
        acties={<Knop>Opslaan</Knop>}
      >
        <label>
          Naam
          <input data-autofocus />
        </label>
      </Dialoog>
    </>
  );
}

describe('Dialoog', () => {
  it('opent met een benoemde dialoog en focus op het autofocus-veld', () => {
    render(<DialoogProef />);
    fireEvent.click(screen.getByRole('button', { name: 'Openen' }));
    const dialoog = screen.getByRole('dialog', { name: 'School bewerken' });
    expect(dialoog.hasAttribute('open')).toBe(true);
    expect(document.activeElement).toBe(screen.getByLabelText('Naam'));
  });

  it('Escape (cancel) en de sluitknop sluiten; de focus gaat terug', () => {
    render(<DialoogProef />);
    const openen = screen.getByRole('button', { name: 'Openen' });
    openen.focus();
    fireEvent.click(openen);
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(openen);

    fireEvent.click(openen);
    fireEvent.click(screen.getByRole('button', { name: 'Sluiten' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('toont geen inhoud als hij dicht is', () => {
    render(<DialoogProef />);
    expect(screen.queryByLabelText('Naam')).toBeNull();
  });

  it('heeft geen toegankelijkheidsfouten (axe)', async () => {
    const { container } = render(<DialoogProef />);
    fireEvent.click(screen.getByRole('button', { name: 'Openen' }));
    expect(await toegankelijkheidsfouten(container)).toEqual([]);
  });
});

function BevestigProef({ opAntwoord }: { opAntwoord: (ja: boolean) => void }) {
  const bevestig = useBevestig();
  return (
    <button
      type="button"
      onClick={() => {
        void bevestig({ titel: 'School verwijderen?', tekst: 'De school verdwijnt.' }).then(
          opAntwoord,
        );
      }}
    >
      Verwijderen
    </button>
  );
}

describe('Bevestiging', () => {
  async function vraag() {
    const opAntwoord = vi.fn();
    render(
      <BevestigingProvider>
        <BevestigProef opAntwoord={opAntwoord} />
      </BevestigingProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Verwijderen' }));
    await screen.findByRole('dialog', { name: 'School verwijderen?' });
    return opAntwoord;
  }

  it('start met de focus op Annuleren', async () => {
    await vraag();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Annuleren' }));
  });

  it('Bevestigen geeft true', async () => {
    const opAntwoord = await vraag();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Bevestigen' }));
      await Promise.resolve();
    });
    expect(opAntwoord).toHaveBeenCalledWith(true);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Annuleren en Escape geven false', async () => {
    const opAntwoord = await vraag();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Annuleren' }));
      await Promise.resolve();
    });
    expect(opAntwoord).toHaveBeenCalledWith(false);

    fireEvent.click(screen.getByRole('button', { name: 'Verwijderen' }));
    await act(async () => {
      fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
      await Promise.resolve();
    });
    expect(opAntwoord).toHaveBeenLastCalledWith(false);
  });
});

function ToastProef() {
  const toon = useToast();
  return (
    <button
      type="button"
      onClick={() => {
        toon('Wijzigingen opgeslagen.');
      }}
    >
      Opslaan
    </button>
  );
}

describe('Toasts', () => {
  function toonProef() {
    render(
      <ToastProvider>
        <ToastProef />
      </ToastProvider>,
    );
  }

  it('de live-regio staat er altijd en krijgt de melding', () => {
    toonProef();
    const regio = screen.getByRole('list', { name: 'Meldingen' });
    expect(regio.getAttribute('aria-live')).toBe('polite');
    fireEvent.click(screen.getByRole('button', { name: 'Opslaan' }));
    expect(regio.textContent).toContain('Wijzigingen opgeslagen.');
  });

  it('verdwijnt vanzelf na de wachttijd', () => {
    vi.useFakeTimers();
    toonProef();
    fireEvent.click(screen.getByRole('button', { name: 'Opslaan' }));
    act(() => {
      vi.advanceTimersByTime(TOAST_DUUR - 1);
    });
    expect(screen.queryByText('Wijzigingen opgeslagen.')).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.queryByText('Wijzigingen opgeslagen.')).toBeNull();
  });

  it('kan ook direct gesloten worden', () => {
    toonProef();
    fireEvent.click(screen.getByRole('button', { name: 'Opslaan' }));
    fireEvent.click(screen.getByRole('button', { name: 'Melding sluiten' }));
    expect(screen.queryByText('Wijzigingen opgeslagen.')).toBeNull();
  });
});

describe('Melding', () => {
  it('een fout is een alert met voorvoegsel voor schermlezers', () => {
    render(<Melding soort="fout">Opslaan is niet gelukt.</Melding>);
    const m = screen.getByRole('alert');
    expect(m.textContent).toBe('Fout: Opslaan is niet gelukt.');
  });

  it('informatie is een status', () => {
    render(<Melding titel="Alleen inzien">Je kunt dit alleen inzien.</Melding>);
    expect(screen.getByRole('status').textContent).toContain('Informatie: Alleen inzien');
  });
});

describe('Knop', () => {
  it('is standaard type="button" en uit tijdens bezig', () => {
    render(<Knop bezig>Opslaan</Knop>);
    const knop = screen.getByRole('button', { name: 'Opslaan' });
    expect(knop.getAttribute('type')).toBe('button');
    expect((knop as HTMLButtonElement).disabled).toBe(true);
    expect(knop.getAttribute('aria-busy')).toBe('true');
  });
});
