import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { MemoryRouter } from 'react-router';
import { toegankelijkheidsfouten } from '../../test/axe';
import { Kruimelpad } from './Kruimelpad';
import { Stappen } from './Stappen';
import { Tabbladen } from './Tabbladen';

afterEach(cleanup);

const TABS = [
  { id: 'a', label: 'Gegevens' },
  { id: 'b', label: 'Contracten' },
  { id: 'c', label: 'Aliassen' },
] as const;

function Proef() {
  const [actief, setActief] = useState<'a' | 'b' | 'c'>('a');
  return (
    <Tabbladen label="Onderdelen" tabs={TABS} actief={actief} onKies={setActief}>
      <p>Inhoud {actief}</p>
    </Tabbladen>
  );
}

describe('Tabbladen', () => {
  it('pijltjes, Home en End wisselen en verplaatsen de focus', () => {
    render(<Proef />);
    const tab = (naam: string) => screen.getByRole('tab', { name: naam });
    tab('Gegevens').focus();
    fireEvent.keyDown(tab('Gegevens'), { key: 'ArrowRight' });
    expect(tab('Contracten').getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(tab('Contracten'));
    fireEvent.keyDown(tab('Contracten'), { key: 'End' });
    expect(document.activeElement).toBe(tab('Aliassen'));
    fireEvent.keyDown(tab('Aliassen'), { key: 'ArrowRight' });
    expect(document.activeElement).toBe(tab('Gegevens'));
    fireEvent.keyDown(tab('Gegevens'), { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(tab('Aliassen'));
    fireEvent.keyDown(tab('Aliassen'), { key: 'Home' });
    expect(document.activeElement).toBe(tab('Gegevens'));
    expect(screen.getByRole('tabpanel', { name: 'Gegevens' }).textContent).toBe('Inhoud a');
  });

  it('alleen het actieve tabblad zit in de tabvolgorde', () => {
    render(<Proef />);
    const tabIndexen = screen.getAllByRole('tab').map((t) => t.getAttribute('tabindex'));
    expect(tabIndexen).toEqual(['0', '-1', '-1']);
  });

  it('heeft geen toegankelijkheidsfouten (axe)', async () => {
    const { container } = render(<Proef />);
    expect(await toegankelijkheidsfouten(container)).toEqual([]);
  });
});

describe('Kruimelpad', () => {
  it('links naar de bovenliggende pagina’s; de huidige is gemarkeerd', async () => {
    const { container } = render(
      <MemoryRouter>
        <Kruimelpad kruimels={[{ label: 'Beheer', pad: '/beheer' }, { label: 'Scholen' }]} />
      </MemoryRouter>,
    );
    const nav = screen.getByRole('navigation', { name: 'Kruimelpad' });
    expect(screen.getByRole('link', { name: 'Beheer' }).getAttribute('href')).toBe('/beheer');
    expect(nav.querySelector('[aria-current="page"]')?.textContent).toBe('Scholen');
    expect(await toegankelijkheidsfouten(container)).toEqual([]);
  });
});

describe('Stappen', () => {
  it('markeert de huidige stap en noemt afgeronde stappen', async () => {
    const { container } = render(
      <Stappen stappen={['Bestand', 'Controle', 'Verwerkt']} huidig={2} />,
    );
    const items = screen.getAllByRole('listitem');
    expect(items[1]?.getAttribute('aria-current')).toBe('step');
    expect(items[0]?.textContent).toContain('(klaar)');
    expect(items[2]?.getAttribute('aria-current')).toBeNull();
    expect(await toegankelijkheidsfouten(container)).toEqual([]);
  });
});
