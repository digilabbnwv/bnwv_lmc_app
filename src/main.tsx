import './lib/zodConfig';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from './App';
import { AuthProvider } from './auth/AuthContext';

const queryClient = new QueryClient();

const root = document.getElementById('root');
if (!root) {
  throw new Error('Element #root ontbreekt in index.html');
}

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </HashRouter>
    </QueryClientProvider>
  </StrictMode>,
);
