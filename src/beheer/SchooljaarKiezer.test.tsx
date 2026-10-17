import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { SchooljaarKiezer, SchooljaarProvider, useSchooljaarKeuze } from './SchooljaarKiezer';

vi.mock('./data', async (origineel) => ({
  ...(await origineel<typeof import('./data')>()),
  useSchooljaren: () => ({
    data: [
      { id: 'sj1', naam: '2025-2026', startdatum: '2025-08-01', einddatum: '2026-07-31' },
      { id: 'sj2', naam: '2026-2027', startdatum: '2026-08-01', einddatum: '2027-07-31' },
    ],
  }),
}));

afterEach(cleanup);

function Pagina({ naam }: { naam: string }) {
  const schooljaar = useSchooljaarKeuze();
  return (
    <section aria-label={naam}>
      <SchooljaarKiezer />
      <p>
        {naam}: {schooljaar}
      </p>
    </section>
  );
}

/** Bootst navigeren na: steeds één pagina tegelijk in beeld. */
function App() {
  const [pagina, setPagina] = useState<'A' | 'B'>('A');
  return (
    <SchooljaarProvider>
      <button
        type="button"
        onClick={() => {
          setPagina(pagina === 'A' ? 'B' : 'A');
        }}
      >
        Andere pagina
      </button>
      <Pagina key={pagina} naam={pagina} />
    </SchooljaarProvider>
  );
}

describe('SchooljaarKiezer', () => {
  it('start bij het huidige schooljaar (op basis van de datum)', () => {
    vi.useFakeTimers({ now: new Date('2026-10-17'), toFake: ['Date'] });
    render(<App />);
    expect(screen.getByText('A: sj2')).toBeTruthy();
    vi.useRealTimers();
  });

  it('de keuze blijft staan als je naar een andere pagina gaat', () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText('Schooljaar'), { target: { value: 'sj1' } });
    expect(screen.getByText('A: sj1')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Andere pagina' }));
    expect(screen.getByText('B: sj1')).toBeTruthy();
    expect(screen.getByLabelText<HTMLSelectElement>('Schooljaar').value).toBe('sj1');
  });

  it('bewaart niets in localStorage of sessionStorage', () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText('Schooljaar'), { target: { value: 'sj1' } });
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });
});
