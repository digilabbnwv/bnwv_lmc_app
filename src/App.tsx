import { lazy, Suspense } from 'react';
import { Route, Routes, useLocation } from 'react-router';
import { AuthPoort } from './auth/AuthPoort';
import { useAuth } from './auth/AuthContext';
import { rechtenVoor } from './auth/rechten';
import { Doelbinding } from './components/Doelbinding';
import { BevestigingProvider } from './components/ui/Bevestiging';
import { Laden } from './components/ui/Laden';
import { ToastProvider } from './components/ui/Toasts';
import { Indeling } from './indeling/Indeling';
import { APP_NAAM } from './indeling/navigatie';
import { Beveiliging } from './pages/Beveiliging';
import { GeplandGerealiseerd } from './weergaven/GeplandGerealiseerd';
import { MijnBelasting } from './weergaven/MijnBelasting';
import { OverDeApp } from './weergaven/OverDeApp';
import { Teamoverzicht } from './weergaven/Teamoverzicht';

// Beheer en accounts worden pas geladen als iemand ze opent.
const BeheerRoutes = lazy(() => import('./beheer/BeheerRoutes'));
const MattImport = lazy(() =>
  import('./import/MattImport').then((m) => ({ default: m.MattImport })),
);
const Accounts = lazy(() => import('./pages/Accounts').then((m) => ({ default: m.Accounts })));

// Componentengalerij met fictieve data: alleen in development, valt weg uit de productiebuild.
const Galerij = import.meta.env.DEV ? lazy(() => import('./voorbeelden/Galerij')) : null;

function Inhoud() {
  const { rollen, gebruiker, uitloggen } = useAuth();
  const rechten = rechtenVoor(rollen);
  return (
    <Indeling
      rechten={rechten}
      email={gebruiker?.email ?? null}
      uitloggen={() => {
        void uitloggen();
      }}
    >
      <Suspense fallback={<Laden />}>
        <Routes>
          {/* Startpagina: C/M/B het teamoverzicht, een lmc de eigen belasting. */}
          <Route path="/" element={rechten.werkInzien ? <Teamoverzicht /> : <MijnBelasting />} />
          <Route path="/mijn-belasting" element={<MijnBelasting />} />
          {rechten.werkInzien ? <Route path="/team" element={<Teamoverzicht />} /> : null}
          <Route path="/gepland-gerealiseerd" element={<GeplandGerealiseerd />} />
          <Route path="/gepland-gerealiseerd/:medewerkerId" element={<GeplandGerealiseerd />} />
          <Route path="/over" element={<OverDeApp />} />
          <Route path="/beveiliging" element={<Beveiliging />} />
          {/* De frontend verbergt alleen; de database en de Edge Functions beslissen. */}
          {rechten.accounts ? <Route path="/accounts" element={<Accounts />} /> : null}
          {rechten.beheer ? <Route path="/beheer/*" element={<BeheerRoutes />} /> : null}
          {rechten.importeren ? <Route path="/import" element={<MattImport />} /> : null}
          <Route path="*" element={<p>Deze pagina bestaat niet.</p>} />
        </Routes>
      </Suspense>
    </Indeling>
  );
}

export function App() {
  const { pathname } = useLocation();
  return (
    <ToastProvider>
      <BevestigingProvider>
        <div className="app">
          {/* Geen gewone ankerlink: met HashRouter zou #inhoud een route worden. */}
          <a
            className="naar-inhoud"
            href="#inhoud"
            onClick={(e) => {
              e.preventDefault();
              document.getElementById('inhoud')?.focus();
            }}
          >
            Naar de inhoud
          </a>
          <header className="app-kop">
            <h1>{APP_NAAM}</h1>
          </header>
          {Galerij && pathname === '/voorbeelden' ? (
            <Suspense fallback={<Laden />}>
              <Galerij />
            </Suspense>
          ) : (
            <AuthPoort>
              <Inhoud />
            </AuthPoort>
          )}
          <footer className="app-voet">
            <Doelbinding />
          </footer>
        </div>
      </BevestigingProvider>
    </ToastProvider>
  );
}
