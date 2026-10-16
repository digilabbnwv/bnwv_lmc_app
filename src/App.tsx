import { Route, Routes } from 'react-router';
import { Doelbinding } from './components/Doelbinding';

export function App() {
  return (
    <div className="app">
      <header className="app-kop">
        <h1>LMC-capaciteit</h1>
      </header>
      <main className="app-inhoud">
        <Routes>
          <Route path="/" element={<p>Welkom. De app is in opbouw.</p>} />
          <Route path="*" element={<p>Deze pagina bestaat niet.</p>} />
        </Routes>
      </main>
      <footer className="app-voet">
        <Doelbinding />
      </footer>
    </div>
  );
}
