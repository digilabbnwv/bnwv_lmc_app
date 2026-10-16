import { lazy, Suspense } from 'react';
import { NavLink, Route, Routes } from 'react-router';
import { AuthPoort } from './auth/AuthPoort';
import { useAuth } from './auth/AuthContext';
import { rechtenVoor } from './auth/rechten';
import { Doelbinding } from './components/Doelbinding';
import { Beveiliging } from './pages/Beveiliging';

// Beheer en accounts worden pas geladen als iemand ze opent.
const BeheerRoutes = lazy(() => import('./beheer/BeheerRoutes'));
const MattImport = lazy(() =>
  import('./import/MattImport').then((m) => ({ default: m.MattImport })),
);
const Accounts = lazy(() => import('./pages/Accounts').then((m) => ({ default: m.Accounts })));

function Navigatie() {
  const { rollen, uitloggen } = useAuth();
  const rechten = rechtenVoor(rollen);
  return (
    <nav aria-label="Hoofdmenu">
      <ul>
        <li>
          <NavLink to="/" end>
            Start
          </NavLink>
        </li>
        {rechten.beheer ? (
          <li>
            <NavLink to="/beheer">Beheer</NavLink>
          </li>
        ) : null}
        {rechten.importeren ? (
          <li>
            <NavLink to="/import">MATT-import</NavLink>
          </li>
        ) : null}
        {rechten.accounts ? (
          <li>
            <NavLink to="/accounts">Accounts</NavLink>
          </li>
        ) : null}
        <li>
          <NavLink to="/beveiliging">Beveiliging</NavLink>
        </li>
        <li>
          <button
            type="button"
            className="secundair"
            onClick={() => {
              void uitloggen();
            }}
          >
            Uitloggen
          </button>
        </li>
      </ul>
    </nav>
  );
}

function Inhoud() {
  const { rollen } = useAuth();
  const rechten = rechtenVoor(rollen);
  return (
    <>
      <Navigatie />
      <Suspense fallback={<p aria-busy="true">Bezig met laden…</p>}>
        <Routes>
          <Route path="/" element={<p>Welkom. De overzichten volgen in een volgende fase.</p>} />
          <Route path="/beveiliging" element={<Beveiliging />} />
          {/* De frontend verbergt alleen; de database en de Edge Functions beslissen. */}
          {rechten.accounts ? <Route path="/accounts" element={<Accounts />} /> : null}
          {rechten.beheer ? <Route path="/beheer/*" element={<BeheerRoutes />} /> : null}
          {rechten.importeren ? <Route path="/import" element={<MattImport />} /> : null}
          <Route path="*" element={<p>Deze pagina bestaat niet.</p>} />
        </Routes>
      </Suspense>
    </>
  );
}

export function App() {
  return (
    <div className="app">
      <header className="app-kop">
        <h1>LMC-capaciteit</h1>
      </header>
      <main className="app-inhoud">
        <AuthPoort>
          <Inhoud />
        </AuthPoort>
      </main>
      <footer className="app-voet">
        <Doelbinding />
      </footer>
    </div>
  );
}
