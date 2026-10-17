import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { rechtenVoor } from '../auth/rechten';
import type { Rol } from '../auth/AuthContext';
import { toegankelijkheidsfouten } from '../test/axe';
import { Indeling } from './Indeling';

afterEach(cleanup);

function toon(rollen: Rol[] = ['manager'], pad = '/team') {
  const uitloggen = vi.fn();
  const resultaat = render(
    <MemoryRouter initialEntries={[pad]}>
      <Indeling
        rechten={rechtenVoor(rollen)}
        email="lotte.visser@voorbeeld.test"
        uitloggen={uitloggen}
      >
        <Routes>
          <Route path="*" element={<h2>Inhoud</h2>} />
        </Routes>
      </Indeling>
    </MemoryRouter>,
  );
  return { ...resultaat, uitloggen };
}

describe('Indeling', () => {
  it('heeft een hoofdmenu en een main-landmark', () => {
    toon();
    expect(screen.getByRole('navigation', { name: 'Hoofdmenu' })).toBeTruthy();
    expect(screen.getByRole('main').id).toBe('inhoud');
  });

  it('groepeert het menu en markeert de huidige pagina', () => {
    toon();
    const groep = screen.getByRole('list', { name: 'Overzichten' });
    const actief = within(groep).getByRole('link', { name: 'Teamoverzicht' });
    expect(actief.getAttribute('aria-current')).toBe('page');
  });

  it('toont alleen de groepen van de rol', () => {
    toon(['lmc'], '/mijn-belasting');
    expect(screen.queryByRole('list', { name: 'Beheer en import' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Teamoverzicht' })).toBeNull();
  });

  it('zet document.title per pagina', async () => {
    toon(['manager'], '/beheer/scholen');
    await waitFor(() => {
      expect(document.title).toBe('Beheer · LMC-capaciteit');
    });
  });

  it('menuknop klapt in en uit; Escape sluit en zet de focus terug', () => {
    toon();
    const knop = screen.getByRole('button', { name: 'Menu' });
    expect(knop.getAttribute('aria-expanded')).toBe('false');
    expect(document.getElementById(knop.getAttribute('aria-controls') ?? '')).toBeTruthy();
    fireEvent.click(knop);
    expect(knop.getAttribute('aria-expanded')).toBe('true');
    const link = screen.getByRole('link', { name: 'Beheer' });
    link.focus();
    fireEvent.keyDown(link, { key: 'Escape' });
    expect(knop.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(knop);
  });

  it('na een keuze in het menu: menu dicht en focus op de inhoud', async () => {
    toon();
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    fireEvent.click(screen.getByRole('link', { name: 'Accounts' }));
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByRole('main'));
    });
    expect(screen.getByRole('button', { name: 'Menu' }).getAttribute('aria-expanded')).toBe(
      'false',
    );
  });

  it('uitloggen roept de functie aan', () => {
    const { uitloggen } = toon();
    fireEvent.click(screen.getByRole('button', { name: 'Uitloggen' }));
    expect(uitloggen).toHaveBeenCalledOnce();
  });

  it('heeft geen toegankelijkheidsfouten (axe)', async () => {
    const { container } = toon();
    expect(await toegankelijkheidsfouten(container)).toEqual([]);
  });
});
