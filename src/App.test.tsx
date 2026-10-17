import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from './App';
import { AuthProvider } from './auth/AuthContext';
import { DOELBINDING_TEKST } from './components/Doelbinding';
import { toegankelijkheidsfouten } from './test/axe';

const nep = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  getSession: vi.fn(),
}));

vi.mock('./lib/supabase', () => ({
  supabase: () => ({
    auth: {
      getSession: nep.getSession,
      signInWithPassword: nep.signInWithPassword,
      onAuthStateChange: (terug: (gebeurtenis: string) => void) => {
        terug('INITIAL_SESSION');
        return { data: { subscription: { unsubscribe: () => undefined } } };
      },
    },
  }),
  functieFout: () => Promise.resolve('fout'),
}));

function toon() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  nep.getSession.mockResolvedValue({ data: { session: null } });
  nep.signInWithPassword.mockReset();
});
afterEach(cleanup);

describe('App zonder sessie', () => {
  it('toont het inlogscherm en de doelbindingstekst', async () => {
    toon();
    expect(await screen.findByRole('heading', { name: 'Inloggen' })).toBeTruthy();
    expect(screen.getByRole('contentinfo').textContent).toContain(DOELBINDING_TEKST);
  });

  it('heeft geen registratie en geen "wachtwoord vergeten"', async () => {
    toon();
    await screen.findByRole('heading', { name: 'Inloggen' });
    expect(screen.queryByRole('link', { name: /registr|aanmelden|vergeten/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /registr|aanmelden|vergeten/i })).toBeNull();
  });

  it('toont geen app-inhoud of navigatie zonder volledige inlog', async () => {
    toon();
    await screen.findByRole('heading', { name: 'Inloggen' });
    expect(screen.queryByRole('navigation')).toBeNull();
  });

  it('"Naar de inhoud" zet de focus op main zonder de route te wijzigen', async () => {
    toon();
    await screen.findByRole('heading', { name: 'Inloggen' });
    const main = screen.getByRole('main');
    fireEvent.click(screen.getByRole('link', { name: 'Naar de inhoud' }));
    expect(document.activeElement).toBe(main);
    expect(screen.getByRole('heading', { name: 'Inloggen' })).toBeTruthy();
  });

  it('inlogscherm heeft geen toegankelijkheidsfouten (axe)', async () => {
    toon();
    await screen.findByRole('heading', { name: 'Inloggen' });
    expect(await toegankelijkheidsfouten(document.body)).toEqual([]);
  });

  it('meldt een mislukte inlog zonder te zeggen wat er fout was', async () => {
    nep.signInWithPassword.mockResolvedValue({ error: { message: 'Invalid login credentials' } });
    toon();
    fireEvent.change(await screen.findByLabelText('E-mailadres'), {
      target: { value: 'iemand@voorbeeld.test' },
    });
    fireEvent.change(screen.getByLabelText('Wachtwoord'), { target: { value: 'onjuist' } });
    fireEvent.click(screen.getByRole('button', { name: 'Inloggen' }));
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toMatch(/niet gelukt/);
    });
    expect(nep.signInWithPassword).toHaveBeenCalledWith({
      email: 'iemand@voorbeeld.test',
      password: 'onjuist',
    });
  });
});
