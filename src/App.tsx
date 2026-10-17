import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Route, Routes, useLocation, useNavigate } from 'react-router';
import { AuthPoort } from './auth/AuthPoort';
import { SchooljaarProvider } from './beheer/SchooljaarKiezer';
import { useAuth, type Rol } from './auth/AuthContext';
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
// Demomodus met fictieve gegevens (#/demo): alleen in development, valt weg uit de build.
const Demo = import.meta.env.DEV ? lazy(() => import('./demo/Demo')) : null;

function Inhoud() {
  const { rollen, gebruiker, uitloggen } = useAuth();
  const rechten = rechtenVoor(rollen);
  return (
    <SchooljaarProvider>
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
    </SchooljaarProvider>
  );
}

const DEMO_ROLLEN: readonly Rol[] = ['lmc', 'coordinator', 'manager', 'beheerder'];

function demoUitPad(pad: string): { rol: Rol; pad: string } | null {
  const m = /^\/demo\/([a-z]+)(\/.*)?$/.exec(pad);
  const rol = DEMO_ROLLEN.find((r) => r === m?.[1]);
  return rol ? { rol, pad: m?.[2] ?? '/' } : null;
}

export function App() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  // Demomodus: #/demo (rol kiezen) of direct #/demo/<rol>/<pagina>, bijv. #/demo/manager/team.
  const [demoStart] = useState(() => (Demo ? demoUitPad(pathname) : null));
  const [demoRol, setDemoRol] = useState<Rol | null>(demoStart?.rol ?? null);
  const demo = Demo && (demoRol !== null || pathname === '/demo');
  // Eén keer bij het starten; navigate verandert bij elke routewissel.
  const demoGestart = useRef(false);
  useEffect(() => {
    if (demoStart && !demoGestart.current) {
      demoGestart.current = true;
      void navigate(demoStart.pad, { replace: true });
    }
  }, [demoStart, navigate]);
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
          {Demo && demo ? (
            <Suspense fallback={<Laden />}>
              <Demo
                rol={demoRol}
                kiesRol={(rol) => {
                  setDemoRol(rol);
                  void navigate('/');
                }}
              >
                <Inhoud />
              </Demo>
            </Suspense>
          ) : Galerij && pathname === '/voorbeelden' ? (
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
