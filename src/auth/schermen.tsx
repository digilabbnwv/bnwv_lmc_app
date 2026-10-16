// Schermen van de inlogstroom (SPEC §7). Er is bewust geen "wachtwoord vergeten"
// en geen registratie: accounts maakt en reset een manager of beheerder.
import { useEffect, useId, useRef, useState } from 'react';
import type { ReactNode, SyntheticEvent } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { codeSchema, controleerWachtwoord } from './wachtwoord';

function Kader({ titel, children }: { titel: string; children: ReactNode }) {
  return (
    <section className="kader" aria-labelledby="kader-titel">
      <h2 id="kader-titel">{titel}</h2>
      {children}
    </section>
  );
}

function Melding({ tekst }: { tekst: string | null }) {
  return (
    <p className="melding" role="alert" aria-live="assertive">
      {tekst ?? ''}
    </p>
  );
}

export function Inloggen() {
  const [email, setEmail] = useState('');
  const [wachtwoord, setWachtwoord] = useState('');
  const [fout, setFout] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);
  const { vernieuw } = useAuth();

  async function verstuur(e: SyntheticEvent) {
    e.preventDefault();
    setBezig(true);
    setFout(null);
    const { error } = await supabase().auth.signInWithPassword({ email, password: wachtwoord });
    setBezig(false);
    if (error) {
      setFout('Inloggen is niet gelukt. Controleer je e-mailadres en wachtwoord.');
      return;
    }
    await vernieuw();
  }

  return (
    <Kader titel="Inloggen">
      <form
        onSubmit={(e) => {
          void verstuur(e);
        }}
      >
        <label>
          E-mailadres
          <input
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
            }}
          />
        </label>
        <label>
          Wachtwoord
          <input
            type="password"
            autoComplete="current-password"
            required
            value={wachtwoord}
            onChange={(e) => {
              setWachtwoord(e.target.value);
            }}
          />
        </label>
        <Melding tekst={fout} />
        <button type="submit" disabled={bezig}>
          Inloggen
        </button>
      </form>
      <p className="toelichting">
        Geen account of wachtwoord kwijt? Neem contact op met een manager of beheerder.
      </p>
    </Kader>
  );
}

export function WachtwoordWijzigen() {
  const [wachtwoord, setWachtwoord] = useState('');
  const [herhaling, setHerhaling] = useState('');
  const [fout, setFout] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);
  const { vernieuw, uitloggen } = useAuth();

  async function verstuur(e: SyntheticEvent) {
    e.preventDefault();
    const probleem = controleerWachtwoord(wachtwoord, herhaling);
    if (probleem) {
      setFout(probleem);
      return;
    }
    setBezig(true);
    setFout(null);
    const { error } = await supabase().auth.updateUser({ password: wachtwoord });
    setBezig(false);
    if (error) {
      setFout('Het wachtwoord kon niet worden gewijzigd. Kies een ander wachtwoord.');
      return;
    }
    await vernieuw();
  }

  return (
    <Kader titel="Kies een nieuw wachtwoord">
      <p>Je bent ingelogd met een tijdelijk wachtwoord. Kies nu je eigen wachtwoord.</p>
      <form
        onSubmit={(e) => {
          void verstuur(e);
        }}
      >
        <label>
          Nieuw wachtwoord (minimaal 12 tekens)
          <input
            type="password"
            autoComplete="new-password"
            required
            minLength={12}
            value={wachtwoord}
            onChange={(e) => {
              setWachtwoord(e.target.value);
            }}
          />
        </label>
        <label>
          Herhaal het nieuwe wachtwoord
          <input
            type="password"
            autoComplete="new-password"
            required
            value={herhaling}
            onChange={(e) => {
              setHerhaling(e.target.value);
            }}
          />
        </label>
        <Melding tekst={fout} />
        <button type="submit" disabled={bezig}>
          Wachtwoord opslaan
        </button>
        <button
          type="button"
          className="secundair"
          onClick={() => {
            void uitloggen();
          }}
        >
          Uitloggen
        </button>
      </form>
    </Kader>
  );
}

interface Inschrijving {
  factorId: string;
  qr: string;
  geheim: string;
}

/**
 * Koppelt een nieuw TOTP-toestel. Gebruikt bij de eerste keer inloggen en op de
 * pagina Beveiliging (tweede toestel).
 */
export function ToestelKoppelen({
  naam,
  onGekoppeld,
  onAnnuleren,
}: {
  naam: string;
  onGekoppeld: () => void;
  onAnnuleren?: () => void;
}) {
  const [inschrijving, setInschrijving] = useState<Inschrijving | null>(null);
  const [code, setCode] = useState('');
  const [fout, setFout] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);
  const gestart = useRef(false);
  const codeId = useId();

  useEffect(() => {
    // StrictMode voert effecten twee keer uit; één inschrijving is genoeg.
    if (gestart.current) return;
    gestart.current = true;
    void (async () => {
      const client = supabase();
      // Een eerder afgebroken, niet-geverifieerde koppeling opruimen.
      const { data: lijst } = await client.auth.mfa.listFactors();
      for (const f of lijst?.all ?? []) {
        if (f.factor_type === 'totp' && f.status === 'unverified') {
          await client.auth.mfa.unenroll({ factorId: f.id });
        }
      }
      const { data, error } = await client.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: naam,
      });
      if (error) {
        setFout('Het koppelen kon niet worden gestart. Kies eventueel een andere naam.');
        return;
      }
      setInschrijving({ factorId: data.id, qr: data.totp.qr_code, geheim: data.totp.secret });
    })();
  }, [naam]);

  async function verstuur(e: SyntheticEvent) {
    e.preventDefault();
    if (!inschrijving) return;
    if (!codeSchema.safeParse(code).success) {
      setFout('Vul de 6 cijfers uit je authenticator-app in.');
      return;
    }
    setBezig(true);
    setFout(null);
    const { error } = await supabase().auth.mfa.challengeAndVerify({
      factorId: inschrijving.factorId,
      code,
    });
    setBezig(false);
    if (error) {
      setFout('Deze code klopt niet (meer). Probeer de volgende code.');
      return;
    }
    onGekoppeld();
  }

  return (
    <div className="toestel-koppelen">
      <ol>
        <li>Open een authenticator-app op je telefoon.</li>
        <li>Scan de QR-code, of voer de sleutel met de hand in.</li>
        <li>Vul de code van 6 cijfers in die de app toont.</li>
      </ol>
      {inschrijving ? (
        <>
          <img
            className="qr"
            src={inschrijving.qr}
            alt="QR-code om dit account aan je authenticator-app toe te voegen"
            width={200}
            height={200}
          />
          <p>
            Sleutel: <code className="geheim">{inschrijving.geheim}</code>
          </p>
        </>
      ) : (
        <p>Bezig met voorbereiden…</p>
      )}
      <form
        onSubmit={(e) => {
          void verstuur(e);
        }}
      >
        <label htmlFor={codeId}>Code uit de app</label>
        <input
          id={codeId}
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          required
          value={code}
          onChange={(e) => {
            setCode(e.target.value.trim());
          }}
        />
        <Melding tekst={fout} />
        <button type="submit" disabled={bezig || !inschrijving}>
          Koppelen
        </button>
        {onAnnuleren ? (
          <button type="button" className="secundair" onClick={onAnnuleren}>
            Annuleren
          </button>
        ) : null}
      </form>
    </div>
  );
}

export function TotpKoppelen() {
  const { vernieuw, uitloggen } = useAuth();
  return (
    <Kader titel="Tweestapsverificatie instellen">
      <p>
        Tweestapsverificatie is verplicht. Koppel een authenticator-app; later kun je op de pagina
        Beveiliging een tweede toestel toevoegen.
      </p>
      <ToestelKoppelen
        naam="Authenticator-app"
        onGekoppeld={() => {
          void vernieuw();
        }}
        onAnnuleren={() => {
          void uitloggen();
        }}
      />
    </Kader>
  );
}

export function TotpCode() {
  const { factoren, vernieuw, uitloggen } = useAuth();
  const [factorId, setFactorId] = useState(factoren[0]?.id ?? '');
  const [code, setCode] = useState('');
  const [fout, setFout] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);

  async function verstuur(e: SyntheticEvent) {
    e.preventDefault();
    if (!codeSchema.safeParse(code).success) {
      setFout('Vul de 6 cijfers uit je authenticator-app in.');
      return;
    }
    setBezig(true);
    setFout(null);
    const { error } = await supabase().auth.mfa.challengeAndVerify({ factorId, code });
    setBezig(false);
    if (error) {
      setFout('Deze code klopt niet. Probeer de volgende code.');
      return;
    }
    await vernieuw();
  }

  return (
    <Kader titel="Code uit je authenticator-app">
      <form
        onSubmit={(e) => {
          void verstuur(e);
        }}
      >
        {factoren.length > 1 ? (
          <label>
            Toestel
            <select
              value={factorId}
              onChange={(e) => {
                setFactorId(e.target.value);
              }}
            >
              {factoren.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.friendly_name ?? 'Toestel'}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label>
          Code (6 cijfers)
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            required
            value={code}
            onChange={(e) => {
              setCode(e.target.value.trim());
            }}
          />
        </label>
        <Melding tekst={fout} />
        <button type="submit" disabled={bezig}>
          Bevestigen
        </button>
        <button
          type="button"
          className="secundair"
          onClick={() => {
            void uitloggen();
          }}
        >
          Uitloggen
        </button>
      </form>
    </Kader>
  );
}

export function GeenToegang() {
  const { uitloggen } = useAuth();
  return (
    <Kader titel="Geen toegang">
      <p>Je account heeft (nog) geen toegang. Neem contact op met een manager of beheerder.</p>
      <button
        type="button"
        onClick={() => {
          void uitloggen();
        }}
      >
        Uitloggen
      </button>
    </Kader>
  );
}
