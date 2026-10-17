// Accounts aanmaken en resetten (manager en beheerder; SPEC §6, §7). Aanmaken en resetten
// gaan in een dialoog die doorloopt naar de wachtwoordstap. Het tijdelijke wachtwoord staat
// alleen in de state van die dialoog en verdwijnt bij sluiten: nooit in een toast, URL,
// localStorage of console.
import { useId, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth, type Rol } from '../auth/AuthContext';
import { useBevestig } from '../components/ui/Bevestiging';
import { Dialoog } from '../components/ui/Dialoog';
import { Badge, LegeStaat } from '../components/ui/Kaart';
import { Knop } from '../components/ui/Knop';
import { Laden } from '../components/ui/Laden';
import { Melding } from '../components/ui/Melding';
import { roepFunctieAan, supabase } from '../lib/supabase';

const ROLNAMEN: Record<Rol, string> = {
  lmc: 'LMC',
  coordinator: 'Coördinator',
  manager: 'Manager',
  beheerder: 'Beheerder',
};
const ALLE_ROLLEN = Object.keys(ROLNAMEN) as Rol[];

export interface Rij {
  medewerkerId: string;
  naam: string;
  email: string;
  actief: boolean;
  gebruikerId: string | null;
  rollen: Rol[];
}

export type AccountFilter = 'alle' | 'met' | 'zonder' | 'inactief';

const FILTERS: { waarde: AccountFilter; label: string }[] = [
  { waarde: 'alle', label: 'Alle medewerkers' },
  { waarde: 'met', label: 'Met account' },
  { waarde: 'zonder', label: 'Zonder account' },
  { waarde: 'inactief', label: 'Niet actief' },
];

/** Zoeken op naam of e-mail en filteren op status. */
export function filterAccounts(rijen: Rij[], zoek: string, filter: AccountFilter): Rij[] {
  const term = zoek.trim().toLocaleLowerCase('nl');
  return rijen.filter((r) => {
    const past =
      !term ||
      r.naam.toLocaleLowerCase('nl').includes(term) ||
      r.email.toLocaleLowerCase('nl').includes(term);
    const status =
      filter === 'alle' ||
      (filter === 'met' && r.gebruikerId !== null) ||
      (filter === 'zonder' && r.gebruikerId === null && r.actief) ||
      (filter === 'inactief' && !r.actief);
    return past && status;
  });
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

function Status({ rij }: { rij: Rij }) {
  if (!rij.actief) return <Badge>Niet actief</Badge>;
  return rij.gebruikerId ? <Badge nadruk>Account</Badge> : <Badge>Geen account</Badge>;
}

type Stap =
  | { soort: 'aanmaken'; rij: Rij }
  | { soort: 'resetten'; rij: Rij }
  | { soort: 'wachtwoord'; rij: Rij; wachtwoord: string };

/** Tijdelijk wachtwoord met kopieerknop en een melding of kopiëren gelukt is. */
function Wachtwoord({ wachtwoord }: { wachtwoord: string }) {
  const code = useRef<HTMLElement>(null);
  const [status, setStatus] = useState('');

  async function kopieer() {
    try {
      await navigator.clipboard.writeText(wachtwoord);
      setStatus('Gekopieerd.');
    } catch {
      // Geen toegang tot het klembord: selecteer de tekst, zodat Ctrl+C werkt.
      const selectie = window.getSelection();
      if (code.current && selectie) {
        const bereik = document.createRange();
        bereik.selectNodeContents(code.current);
        selectie.removeAllRanges();
        selectie.addRange(bereik);
      }
      setStatus('Kopiëren lukte niet. Het wachtwoord is geselecteerd: gebruik Ctrl+C.');
    }
  }

  return (
    <>
      <p className="wachtwoord-vak">
        <code ref={code} className="geheim">
          {wachtwoord}
        </code>
      </p>
      <p className="knoppen">
        <Knop
          variant="secundair"
          data-autofocus
          onClick={() => {
            void kopieer();
          }}
        >
          Kopiëren
        </Knop>
        <span role="status" className="gedempt">
          {status}
        </span>
      </p>
    </>
  );
}

export function Accounts() {
  const bevestig = useBevestig();
  const { gebruiker, rollen: eigenRollen } = useAuth();
  const queryClient = useQueryClient();
  const rijen = useQuery({ queryKey: ['accounts'], queryFn: laadRijen });
  const [zoek, setZoek] = useState('');
  const [filter, setFilter] = useState<AccountFilter>('alle');
  const [stap, setStap] = useState<Stap | null>(null);
  const [rollen, setRollen] = useState<Rol[]>([]);
  const isBeheerder = eigenRollen.includes('beheerder');
  const rolfoutId = useId();

  const aanmaken = useMutation({
    mutationFn: async (rij: Rij) => {
      const data = await roepFunctieAan<{ tijdelijk_wachtwoord: string }>('gebruiker-aanmaken', {
        medewerker_id: rij.medewerkerId,
        rollen,
      });
      return { rij, wachtwoord: data.tijdelijk_wachtwoord };
    },
    onSuccess: ({ rij, wachtwoord }) => {
      setStap({ soort: 'wachtwoord', rij, wachtwoord });
      void queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });

  const resetten = useMutation({
    mutationFn: async (rij: Rij) => {
      const data = await roepFunctieAan<{ tijdelijk_wachtwoord: string }>('account-resetten', {
        gebruiker_id: rij.gebruikerId,
      });
      return { rij, wachtwoord: data.tijdelijk_wachtwoord };
    },
    onSuccess: ({ rij, wachtwoord }) => {
      setStap({ soort: 'wachtwoord', rij, wachtwoord });
    },
  });

  function open(nieuw: Stap) {
    aanmaken.reset();
    resetten.reset();
    setRollen([]);
    setStap(nieuw);
  }

  function sluit() {
    // Het wachtwoord verdwijnt met de state; ook uit de mutation-cache van TanStack Query.
    setStap(null);
    setRollen([]);
    aanmaken.reset();
    resetten.reset();
  }

  async function probeerSluiten() {
    if (stap?.soort === 'wachtwoord') {
      const ja = await bevestig({
        titel: 'Wachtwoord sluiten?',
        tekst:
          'Het wachtwoord wordt daarna niet meer getoond. Heb je het nog niet doorgegeven, dan moet je het account opnieuw resetten.',
        bevestigTekst: 'Sluiten',
      });
      if (!ja) return;
    }
    sluit();
  }

  const getoond = useMemo(
    () => filterAccounts(rijen.data ?? [], zoek, filter),
    [rijen.data, zoek, filter],
  );
  const gefilterd = zoek.trim() !== '' || filter !== 'alle';
  const fout = aanmaken.error ?? resetten.error;
  const kiesbareRollen = ALLE_ROLLEN.filter((r) => r !== 'beheerder' || isBeheerder);

  const titel =
    stap === null
      ? ''
      : stap.soort === 'aanmaken'
        ? `Account aanmaken voor ${stap.rij.naam}`
        : stap.soort === 'resetten'
          ? `Account van ${stap.rij.naam} resetten`
          : `Tijdelijk wachtwoord voor ${stap.rij.naam}`;

  return (
    <section aria-labelledby="accounts-titel">
      <h2 id="accounts-titel">Accounts</h2>
      <p className="toelichting">
        Maak een account aan voor een medewerker, of reset een account als iemand zijn wachtwoord of
        toestel kwijt is. Het tijdelijke wachtwoord geef je persoonlijk door.
      </p>

      <div className="overzicht-balk">
        <label className="veld">
          <span className="veld-label">Zoeken op naam of e-mail</span>
          <input
            type="search"
            value={zoek}
            onChange={(e) => {
              setZoek(e.target.value);
            }}
          />
        </label>
        <label className="veld">
          <span className="veld-label">Toon</span>
          <select
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value as AccountFilter);
            }}
          >
            {FILTERS.map((f) => (
              <option key={f.waarde} value={f.waarde}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
        {rijen.data ? (
          <p className="telling gedempt" aria-live="polite">
            {gefilterd
              ? `${String(getoond.length)} van ${String(rijen.data.length)} medewerkers`
              : `${String(rijen.data.length)} medewerkers`}
          </p>
        ) : null}
      </div>

      {rijen.isPending ? <Laden /> : null}
      {rijen.isError ? (
        <Melding soort="fout">De accounts konden niet worden geladen.</Melding>
      ) : null}
      {rijen.data && getoond.length === 0 ? (
        <LegeStaat titel="Geen medewerkers gevonden">
          {gefilterd ? 'Pas je zoekterm of filter aan.' : 'Voeg eerst medewerkers toe bij Beheer.'}
        </LegeStaat>
      ) : null}
      {getoond.length > 0 ? (
        <div className="tabel-schuif tabel-vast">
          <table>
            <caption className="verborgen">Accounts</caption>
            <thead>
              <tr>
                <th scope="col">Medewerker</th>
                <th scope="col">Status</th>
                <th scope="col">Rollen</th>
                <th scope="col">
                  <span className="verborgen">Actie</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {getoond.map((rij) => {
                const eigen = rij.gebruikerId !== null && rij.gebruikerId === gebruiker?.id;
                return (
                  <tr key={rij.medewerkerId}>
                    <th scope="row">
                      {rij.naam}
                      <br />
                      <span className="gedempt">{rij.email}</span>
                    </th>
                    <td>
                      <Status rij={rij} />
                    </td>
                    <td>
                      {rij.rollen.length > 0 ? (
                        <span className="badges">
                          {rij.rollen.map((r) => (
                            <Badge key={r}>{ROLNAMEN[r]}</Badge>
                          ))}
                        </span>
                      ) : (
                        <span className="gedempt">—</span>
                      )}
                    </td>
                    <td className="actie">
                      {rij.gebruikerId ? (
                        <Knop
                          variant="secundair"
                          disabled={eigen}
                          title={eigen ? 'Je kunt je eigen account niet resetten.' : undefined}
                          aria-label={`Account van ${rij.naam} resetten`}
                          onClick={() => {
                            open({ soort: 'resetten', rij });
                          }}
                        >
                          Resetten
                        </Knop>
                      ) : rij.actief ? (
                        <Knop
                          aria-label={`Account aanmaken voor ${rij.naam}`}
                          onClick={() => {
                            open({ soort: 'aanmaken', rij });
                          }}
                        >
                          Account aanmaken
                        </Knop>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      <Dialoog
        open={stap !== null}
        stap={stap?.soort ?? 'dicht'}
        titel={titel}
        opSluiten={() => {
          void probeerSluiten();
        }}
        acties={
          stap?.soort === 'aanmaken' ? (
            <>
              <Knop variant="secundair" onClick={sluit}>
                Annuleren
              </Knop>
              <Knop
                bezig={aanmaken.isPending}
                disabled={rollen.length === 0}
                aria-describedby={rollen.length === 0 ? rolfoutId : undefined}
                onClick={() => {
                  aanmaken.mutate(stap.rij);
                }}
              >
                Account aanmaken
              </Knop>
            </>
          ) : stap?.soort === 'resetten' ? (
            <>
              <Knop variant="secundair" data-autofocus onClick={sluit}>
                Annuleren
              </Knop>
              <Knop
                bezig={resetten.isPending}
                onClick={() => {
                  resetten.mutate(stap.rij);
                }}
              >
                Resetten
              </Knop>
            </>
          ) : stap?.soort === 'wachtwoord' ? (
            <Knop onClick={sluit}>Ik heb het wachtwoord doorgegeven</Knop>
          ) : null
        }
      >
        {fout && stap?.soort !== 'wachtwoord' ? (
          <Melding soort="fout">{fout.message}</Melding>
        ) : null}

        {stap?.soort === 'aanmaken' ? (
          <>
            <p>
              Er komt een account met het e-mailadres <strong>{stap.rij.email}</strong>. Daarna
              krijg je een tijdelijk wachtwoord om persoonlijk door te geven.
            </p>
            <fieldset className="veldgroep">
              <legend>Rollen</legend>
              {kiesbareRollen.map((r, i) => (
                <label key={r} className="veld-vinkje">
                  <input
                    type="checkbox"
                    data-autofocus={i === 0 || undefined}
                    checked={rollen.includes(r)}
                    onChange={() => {
                      setRollen((huidig) =>
                        huidig.includes(r) ? huidig.filter((x) => x !== r) : [...huidig, r],
                      );
                    }}
                  />
                  {ROLNAMEN[r]}
                </label>
              ))}
              {rollen.length === 0 ? (
                <p id={rolfoutId} className="gedempt">
                  Kies minstens één rol.
                </p>
              ) : null}
            </fieldset>
          </>
        ) : null}

        {stap?.soort === 'resetten' ? (
          <p>
            {stap.rij.naam} krijgt een nieuw tijdelijk wachtwoord en moet bij de volgende keer
            inloggen een eigen wachtwoord kiezen en de authenticator-app opnieuw koppelen. Alle
            gekoppelde toestellen worden verwijderd.
          </p>
        ) : null}

        {stap?.soort === 'wachtwoord' ? (
          <>
            <Melding soort="let-op" titel="Wordt maar één keer getoond">
              Geef dit wachtwoord persoonlijk door. Bij de eerste keer inloggen kiest{' '}
              {stap.rij.naam} een eigen wachtwoord en koppelt een authenticator-app.
            </Melding>
            <Wachtwoord wachtwoord={stap.wachtwoord} />
          </>
        ) : null}
      </Dialoog>
    </section>
  );
}
