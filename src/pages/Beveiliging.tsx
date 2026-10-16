import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { ToestelKoppelen } from '../auth/schermen';
import { supabase } from '../lib/supabase';

/** Gekoppelde toestellen beheren; een tweede toestel toevoegen (SPEC §7). */
export function Beveiliging() {
  const { factoren, vernieuw } = useAuth();
  const [toevoegen, setToevoegen] = useState(false);
  const [naam, setNaam] = useState('Tweede toestel');
  const [gestart, setGestart] = useState<string | null>(null);
  const [fout, setFout] = useState<string | null>(null);

  async function ontkoppel(factorId: string) {
    setFout(null);
    const { error } = await supabase().auth.mfa.unenroll({ factorId });
    if (error) setFout('Het toestel kon niet worden ontkoppeld.');
    await vernieuw();
  }

  return (
    <section aria-labelledby="beveiliging-titel">
      <h2 id="beveiliging-titel">Beveiliging</h2>
      <h3>Gekoppelde toestellen</h3>
      <ul className="lijst">
        {factoren.map((f) => (
          <li key={f.id}>
            <span>{f.friendly_name ?? 'Toestel'}</span>{' '}
            <span className="gedempt">
              (gekoppeld op {new Date(f.created_at).toLocaleDateString('nl-NL')})
            </span>{' '}
            <button
              type="button"
              className="secundair"
              disabled={factoren.length <= 1}
              title={
                factoren.length <= 1 ? 'Je laatste toestel kun je niet ontkoppelen.' : undefined
              }
              onClick={() => {
                void ontkoppel(f.id);
              }}
            >
              Ontkoppelen
            </button>
          </li>
        ))}
      </ul>
      <p className="melding" role="alert" aria-live="assertive">
        {fout ?? ''}
      </p>

      {gestart ? (
        <ToestelKoppelen
          naam={gestart}
          onGekoppeld={() => {
            setGestart(null);
            setToevoegen(false);
            void vernieuw();
          }}
          onAnnuleren={() => {
            setGestart(null);
            setToevoegen(false);
          }}
        />
      ) : toevoegen ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const schoon = naam.trim();
            if (schoon.length === 0) return;
            setGestart(schoon);
          }}
        >
          <label>
            Naam van het toestel
            <input
              required
              maxLength={50}
              value={naam}
              onChange={(e) => {
                setNaam(e.target.value);
              }}
            />
          </label>
          <button type="submit">Verder</button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => {
            setToevoegen(true);
          }}
        >
          Toestel toevoegen
        </button>
      )}
    </section>
  );
}
