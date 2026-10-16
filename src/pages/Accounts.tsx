import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth, type Rol } from '../auth/AuthContext';
import { roepFunctieAan, supabase } from '../lib/supabase';

const ROLNAMEN: Record<Rol, string> = {
  lmc: 'LMC',
  coordinator: 'Coördinator',
  manager: 'Manager',
  beheerder: 'Beheerder',
};
const ALLE_ROLLEN = Object.keys(ROLNAMEN) as Rol[];

interface Rij {
  medewerkerId: string;
  naam: string;
  email: string;
  actief: boolean;
  gebruikerId: string | null;
  rollen: Rol[];
}

async function laadRijen(): Promise<Rij[]> {
  const client = supabase();
  const [medewerkers, profielen, rollen] = await Promise.all([
    client.from('medewerker').select('id, voornaam, achternaam, email, actief').order('achternaam'),
    client.from('profiel').select('gebruiker_id, medewerker_id'),
    client.from('gebruiker_rol').select('gebruiker_id, rol'),
  ]);
  if (medewerkers.error) throw medewerkers.error;
  const gebruikerVan = new Map(
    (profielen.data ?? []).map((p) => [p.medewerker_id, p.gebruiker_id]),
  );
  return medewerkers.data.map((m) => {
    const gebruikerId = gebruikerVan.get(m.id) ?? null;
    return {
      medewerkerId: m.id,
      naam: `${m.voornaam} ${m.achternaam}`,
      email: m.email,
      actief: m.actief,
      gebruikerId,
      rollen: (rollen.data ?? []).filter((r) => r.gebruiker_id === gebruikerId).map((r) => r.rol),
    };
  });
}

interface Resultaat {
  naam: string;
  wachtwoord: string;
}

/** Accounts aanmaken en resetten (manager en beheerder; SPEC §6, §7). */
export function Accounts() {
  const { gebruiker, rollen: eigenRollen } = useAuth();
  const queryClient = useQueryClient();
  const rijen = useQuery({ queryKey: ['accounts'], queryFn: laadRijen });
  const [keuze, setKeuze] = useState<Record<string, Rol[]>>({});
  const [resultaat, setResultaat] = useState<Resultaat | null>(null);
  const [fout, setFout] = useState<string | null>(null);
  const isBeheerder = eigenRollen.includes('beheerder');

  const aanmaken = useMutation({
    mutationFn: async (rij: Rij) => {
      const data = await roepFunctieAan<{ tijdelijk_wachtwoord: string }>('gebruiker-aanmaken', {
        medewerker_id: rij.medewerkerId,
        rollen: keuze[rij.medewerkerId] ?? [],
      });
      return { naam: rij.naam, wachtwoord: data.tijdelijk_wachtwoord };
    },
    onSuccess: (r) => {
      setResultaat(r);
      setFout(null);
      void queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
    onError: (e) => {
      setFout(e.message);
    },
  });

  const resetten = useMutation({
    mutationFn: async (rij: Rij) => {
      const data = await roepFunctieAan<{ tijdelijk_wachtwoord: string }>('account-resetten', {
        gebruiker_id: rij.gebruikerId,
      });
      return { naam: rij.naam, wachtwoord: data.tijdelijk_wachtwoord };
    },
    onSuccess: (r) => {
      setResultaat(r);
      setFout(null);
    },
    onError: (e) => {
      setFout(e.message);
    },
  });

  function wisselRol(medewerkerId: string, rol: Rol) {
    setKeuze((huidig) => {
      const lijst = huidig[medewerkerId] ?? [];
      return {
        ...huidig,
        [medewerkerId]: lijst.includes(rol) ? lijst.filter((r) => r !== rol) : [...lijst, rol],
      };
    });
  }

  return (
    <section aria-labelledby="accounts-titel">
      <h2 id="accounts-titel">Accounts</h2>

      {resultaat ? (
        <div className="kader" role="status">
          <h3>Tijdelijk wachtwoord voor {resultaat.naam}</h3>
          <p>
            Geef dit wachtwoord persoonlijk door. Het wordt <strong>maar één keer</strong> getoond.
            Bij de eerste keer inloggen kiest de medewerker een eigen wachtwoord en koppelt een
            authenticator-app.
          </p>
          <p>
            <code className="geheim">{resultaat.wachtwoord}</code>{' '}
            <button
              type="button"
              className="secundair"
              onClick={() => {
                void navigator.clipboard.writeText(resultaat.wachtwoord);
              }}
            >
              Kopiëren
            </button>
          </p>
          <button
            type="button"
            onClick={() => {
              setResultaat(null);
            }}
          >
            Ik heb het wachtwoord doorgegeven
          </button>
        </div>
      ) : null}

      <p className="melding" role="alert" aria-live="assertive">
        {fout ?? ''}
      </p>

      {rijen.isPending ? <p aria-busy="true">Bezig met laden…</p> : null}
      {rijen.isError ? <p role="alert">De accounts konden niet worden geladen.</p> : null}
      {rijen.data ? (
        <table>
          <thead>
            <tr>
              <th scope="col">Medewerker</th>
              <th scope="col">E-mail</th>
              <th scope="col">Account</th>
              <th scope="col">Rollen</th>
              <th scope="col">Actie</th>
            </tr>
          </thead>
          <tbody>
            {rijen.data.map((rij) => {
              const eigen = rij.gebruikerId !== null && rij.gebruikerId === gebruiker?.id;
              return (
                <tr key={rij.medewerkerId}>
                  <td>
                    {rij.naam}
                    {rij.actief ? '' : ' (niet actief)'}
                  </td>
                  <td>{rij.email}</td>
                  <td>{rij.gebruikerId ? 'Ja' : 'Nee'}</td>
                  <td>
                    {rij.gebruikerId ? (
                      rij.rollen.map((r) => ROLNAMEN[r]).join(', ') || '—'
                    ) : (
                      <fieldset className="rollen">
                        <legend className="verborgen">Rollen voor {rij.naam}</legend>
                        {ALLE_ROLLEN.filter((r) => r !== 'beheerder' || isBeheerder).map((r) => (
                          <label key={r}>
                            <input
                              type="checkbox"
                              disabled={!rij.actief}
                              checked={(keuze[rij.medewerkerId] ?? []).includes(r)}
                              onChange={() => {
                                wisselRol(rij.medewerkerId, r);
                              }}
                            />
                            {ROLNAMEN[r]}
                          </label>
                        ))}
                      </fieldset>
                    )}
                  </td>
                  <td>
                    {rij.gebruikerId ? (
                      <button
                        type="button"
                        className="secundair"
                        disabled={eigen || resetten.isPending}
                        title={eigen ? 'Je kunt je eigen account niet resetten.' : undefined}
                        onClick={() => {
                          if (
                            window.confirm(
                              `Account van ${rij.naam} resetten? Alle gekoppelde toestellen worden verwijderd.`,
                            )
                          ) {
                            resetten.mutate(rij);
                          }
                        }}
                      >
                        Resetten
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={
                          !rij.actief ||
                          (keuze[rij.medewerkerId] ?? []).length === 0 ||
                          aanmaken.isPending
                        }
                        onClick={() => {
                          aanmaken.mutate(rij);
                        }}
                      >
                        Account aanmaken
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : null}
    </section>
  );
}
