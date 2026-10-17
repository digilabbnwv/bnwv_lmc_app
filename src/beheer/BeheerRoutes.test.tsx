import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import type { Rol } from '../auth/AuthContext';
import { toegankelijkheidsfouten } from '../test/axe';
import BeheerRoutes from './BeheerRoutes';
import { ONDERDELEN } from './onderdelen';

const nep = vi.hoisted(() => ({ rollen: [] as Rol[] }));
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ rollen: nep.rollen }) }));

afterEach(cleanup);

function toon(rollen: Rol[]) {
  nep.rollen = rollen;
  return render(
    <MemoryRouter initialEntries={['/beheer']}>
      <Routes>
        <Route path="/beheer/*" element={<BeheerRoutes />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Beheeroverzicht', () => {
  it('een kaart per groep, elk onderdeel met uitleg', () => {
    toon(['coordinator']);
    for (const groep of ['Configuratie', 'Medewerkers', 'Werk', 'Toewijzingen']) {
      expect(screen.getByRole('region', { name: groep })).toBeTruthy();
    }
    const werk = screen.getByRole('region', { name: 'Werk' });
    const scholen = within(werk).getByRole('link', { name: /^Scholen/ });
    expect(scholen.getAttribute('href')).toBe('/beheer/scholen');
    expect(scholen.textContent).toContain('Scholen met schooltype en vestiging.');
  });

  it('alle onderdelen hebben een uitleg en een uniek pad', () => {
    expect(new Set(ONDERDELEN.map((o) => o.pad)).size).toBe(ONDERDELEN.length);
    for (const o of ONDERDELEN) expect(o.omschrijving.length).toBeGreaterThan(10);
  });

  it('heeft geen toegankelijkheidsfouten (axe)', async () => {
    const { container } = toon(['manager']);
    expect(await toegankelijkheidsfouten(container)).toEqual([]);
  });
});
