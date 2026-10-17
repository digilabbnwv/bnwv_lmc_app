// Demomodus (alleen development, #/demo): de echte schermen met fictieve gegevens, zonder
// inloggen en zonder verbinding met Supabase. Voor controle en schermafbeeldingen.
import type { User } from '@supabase/supabase-js';
import { useEffect, type ReactNode } from 'react';
import { AuthContext, type AuthWaarde, type Rol } from '../auth/AuthContext';
import { zetDemoClient } from '../lib/supabase';
import { maakNepSupabase } from './nepSupabase';

// Bij het laden van deze module (alleen via #/demo in development).
zetDemoClient(maakNepSupabase());

export const DEMO_ROLLEN: { rol: Rol; naam: string; medewerker: string }[] = [
  { rol: 'lmc', naam: 'LMC (Lotte Visser)', medewerker: 'mw-lotte' },
  { rol: 'coordinator', naam: 'Coördinator (Kees van Dijk)', medewerker: 'mw-kees' },
  { rol: 'manager', naam: 'Manager (Fatima el Amrani)', medewerker: 'mw-fatima' },
  { rol: 'beheerder', naam: 'Beheerder (zonder werkrechten)', medewerker: 'mw-pieter' },
];

export const DEMO_TEKST = 'Demo met fictieve gegevens. Wijzigingen worden niet opgeslagen.';

interface Props {
  rol: Rol | null;
  kiesRol: (rol: Rol) => void;
  children: ReactNode;
}

/**
 * ?stappen=... in de URL: na het laden een paar vaste handelingen, gescheiden door "|",
 * voor reproduceerbare schermafbeeldingen (zie docs/KWALITEIT.md). Bijvoorbeeld
 * "klik:Bewerken", "vink:LMC" of "bestand" (kiest een fictief XML-bestand).
 */
// StrictMode voert effecten in development twee keer uit; de stappen lopen maar één keer.
let stappenGestart = false;

async function voerStappenUit(stappen: string[]) {
  if (stappenGestart) return;
  stappenGestart = true;
  const wacht = (ms: number) =>
    new Promise((klaar) => {
      setTimeout(klaar, ms);
    });
  await wacht(1500);
  for (const stap of stappen) {
    if (stap === 'bestand') {
      const invoer = document.querySelector<HTMLInputElement>('input[type=file]');
      if (invoer) {
        const lijst = new DataTransfer();
        lijst.items.add(
          new File(['<Report/>'], 'export-september.xml', { type: 'application/xml' }),
        );
        invoer.files = lijst.files;
        invoer.dispatchEvent(new Event('change', { bubbles: true }));
      }
    } else if (stap.startsWith('vink:')) {
      const tekst = stap.slice('vink:'.length);
      const bereik = document.querySelector('dialog[open]') ?? document;
      const label = [...bereik.querySelectorAll('label')].find(
        (el) => el.textContent.trim() === tekst,
      );
      label?.querySelector<HTMLInputElement>('input')?.click();
    } else if (stap.startsWith('klik:')) {
      const tekst = stap.slice('klik:'.length);
      // Eerst binnen een open dialoog zoeken, dan op de pagina.
      const bereik = document.querySelector('dialog[open]') ?? document;
      const knop = [...bereik.querySelectorAll<HTMLElement>('button, a, label')].find(
        (el) => el.getAttribute('aria-label') === tekst || el.textContent.trim() === tekst,
      );
      knop?.click();
    }
    await wacht(700);
  }
}

export default function Demo({ rol, kiesRol, children }: Props) {
  useEffect(() => {
    const stappen = new URLSearchParams(window.location.search).get('stappen');
    if (rol && stappen) void voerStappenUit(stappen.split('|'));
  }, [rol]);

  if (rol === null) {
    return (
      <main id="inhoud" tabIndex={-1} className="app-inhoud app-inhoud-smal">
        <section className="kader" aria-labelledby="demo-titel">
          <h2 id="demo-titel">Demomodus</h2>
          <p>{DEMO_TEKST} Alleen beschikbaar in development.</p>
          <p>Kies een rol:</p>
          <div className="knoppen">
            {DEMO_ROLLEN.map((r) => (
              <button
                key={r.rol}
                type="button"
                className="secundair"
                onClick={() => {
                  kiesRol(r.rol);
                }}
              >
                {r.naam}
              </button>
            ))}
          </div>
        </section>
      </main>
    );
  }

  const keuze = DEMO_ROLLEN.find((r) => r.rol === rol);
  const waarde: AuthWaarde = {
    stap: 'app',
    gebruiker: { id: `gb-${rol}`, email: `${rol}@voorbeeld.test` } as User,
    factoren: [],
    rollen: [rol],
    medewerkerId: keuze?.medewerker ?? null,
    vernieuw: () => Promise.resolve(),
    uitloggen: () => {
      window.location.hash = '#/demo';
      window.location.reload();
      return Promise.resolve();
    },
  };
  // ?schermafbeelding in de URL: geen demobalk (voor de handleiding; bijschrift noemt de demo).
  const balk = !new URLSearchParams(window.location.search).has('schermafbeelding');
  return (
    <AuthContext value={waarde}>
      {balk ? (
        <p className="demo-balk" role="note">
          {DEMO_TEKST} Rol: {keuze?.naam}.{' '}
          <button
            type="button"
            className="stil"
            onClick={() => {
              window.location.hash = '#/demo';
              window.location.reload();
            }}
          >
            Andere rol (herladen)
          </button>
        </p>
      ) : null}
      {children}
    </AuthContext>
  );
}
