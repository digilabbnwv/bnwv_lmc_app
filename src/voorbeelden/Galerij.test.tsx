// De galerij toont alle basiscomponenten samen: één axe-ronde over het geheel.
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BevestigingProvider } from '../components/ui/Bevestiging';
import { ToastProvider } from '../components/ui/Toasts';
import { toegankelijkheidsfouten } from '../test/axe';
import Galerij from './Galerij';

afterEach(cleanup);

describe('Componentengalerij', () => {
  it('rendert alle onderdelen zonder toegankelijkheidsfouten (axe)', async () => {
    const { container } = render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={['/voorbeelden']}>
          <ToastProvider>
            <BevestigingProvider>
              <Galerij />
            </BevestigingProvider>
          </ToastProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByRole('heading', { name: 'Componentengalerij' })).toBeTruthy();
    await screen.findByText('De Regenboog');
    expect(await toegankelijkheidsfouten(container)).toEqual([]);
  });
});
