import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { App } from './App';
import { DOELBINDING_TEKST } from './components/Doelbinding';

afterEach(cleanup);

describe('App', () => {
  it('toont altijd de doelbindingstekst in de footer', () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );
    const voet = screen.getByRole('contentinfo');
    expect(voet.textContent).toContain(DOELBINDING_TEKST);
  });
});
