import { NavLink, Route, Routes } from 'react-router';
import { AuthPoort } from './auth/AuthPoort';
import { useAuth } from './auth/AuthContext';
import { Doelbinding } from './components/Doelbinding';
import { Accounts } from './pages/Accounts';
import { Beveiliging } from './pages/Beveiliging';

function Navigatie() {
  const { rollen, uitloggen } = useAuth();
  const magAccountsBeheren = rollen.includes('manager') || rollen.includes('beheerder');
  return (
    <nav aria-label="Hoofdmenu">
      <ul>
        <li>
          <NavLink to="/">Start</NavLink>
        </li>
        {magAccountsBeheren ? (
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
  const magAccountsBeheren = rollen.includes('manager') || rollen.includes('beheerder');
  return (
    <>
      <Navigatie />
      <Routes>
        <Route path="/" element={<p>Welkom. De overzichten volgen in een volgende fase.</p>} />
        <Route path="/beveiliging" element={<Beveiliging />} />
        {/* De frontend verbergt alleen; de database en de Edge Functions beslissen. */}
        {magAccountsBeheren ? <Route path="/accounts" element={<Accounts />} /> : null}
        <Route path="*" element={<p>Deze pagina bestaat niet.</p>} />
      </Routes>
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
