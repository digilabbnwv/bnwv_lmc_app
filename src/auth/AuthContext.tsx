import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Factor, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';
import { bepaalStap, type AuthToestand, type Stap } from './stap';
import { useInactiviteit } from './useInactiviteit';

export type Rol = Database['public']['Enums']['rol'];

interface AuthWaarde {
  stap: Stap;
  gebruiker: User | null;
  /** Geverifieerde TOTP-factoren (toestellen). */
  factoren: Factor[];
  rollen: Rol[];
  /** Laadt de toestand opnieuw, bijvoorbeeld na een wachtwoordwijziging of MFA-verificatie. */
  vernieuw: () => Promise<void>;
  uitloggen: () => Promise<void>;
}

const AuthContext = createContext<AuthWaarde | null>(null);

const BEGIN: AuthToestand = {
  geladen: false,
  sessie: false,
  aal: null,
  heeftGeverifieerdeFactor: false,
  moetWachtwoordWijzigen: false,
  heeftToegangNaMfa: false,
};

interface Status {
  moet_wachtwoord_wijzigen?: boolean;
  heeft_toegang_na_mfa?: boolean;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [toestand, setToestand] = useState<AuthToestand>(BEGIN);
  const [gebruiker, setGebruiker] = useState<User | null>(null);
  const [factoren, setFactoren] = useState<Factor[]>([]);
  const [rollen, setRollen] = useState<Rol[]>([]);

  const vernieuw = useCallback(async () => {
    const client = supabase();
    const { data: sessieData } = await client.auth.getSession();
    const sessie = sessieData.session;
    if (!sessie) {
      setGebruiker(null);
      setFactoren([]);
      setRollen([]);
      setToestand({ ...BEGIN, geladen: true });
      return;
    }
    const [aalAntwoord, factorAntwoord, statusAntwoord] = await Promise.all([
      client.auth.mfa.getAuthenticatorAssuranceLevel(),
      client.auth.mfa.listFactors(),
      client.rpc('mijn_status'),
    ]);
    const aal = aalAntwoord.data?.currentLevel ?? null;
    const geverifieerd = factorAntwoord.data?.totp ?? [];
    const status = (statusAntwoord.data ?? {}) as Status;

    let eigenRollen: Rol[] = [];
    if (aal === 'aal2') {
      const { data } = await client
        .from('gebruiker_rol')
        .select('rol')
        .eq('gebruiker_id', sessie.user.id);
      eigenRollen = (data ?? []).map((r) => r.rol);
    }

    setGebruiker(sessie.user);
    setFactoren(geverifieerd);
    setRollen(eigenRollen);
    setToestand({
      geladen: true,
      sessie: true,
      aal: aal === 'aal2' ? 'aal2' : aal === 'aal1' ? 'aal1' : null,
      heeftGeverifieerdeFactor: geverifieerd.length > 0,
      moetWachtwoordWijzigen: status.moet_wachtwoord_wijzigen === true,
      heeftToegangNaMfa: status.heeft_toegang_na_mfa === true,
    });
  }, []);

  const uitloggen = useCallback(async () => {
    await supabase().auth.signOut();
    await vernieuw();
  }, [vernieuw]);

  useEffect(() => {
    // Supabase meldt bij het abonneren direct INITIAL_SESSION; daarmee laadt de begintoestand.
    const { data } = supabase().auth.onAuthStateChange((gebeurtenis) => {
      // Niet binnen de callback zelf Supabase aanroepen (kan vastlopen).
      if (
        gebeurtenis === 'INITIAL_SESSION' ||
        gebeurtenis === 'SIGNED_OUT' ||
        gebeurtenis === 'SIGNED_IN'
      ) {
        window.setTimeout(() => {
          void vernieuw();
        }, 0);
      }
    });
    return () => {
      data.subscription.unsubscribe();
    };
  }, [vernieuw]);

  useInactiviteit(toestand.sessie, () => {
    void uitloggen();
  });

  const waarde = useMemo<AuthWaarde>(
    () => ({ stap: bepaalStap(toestand), gebruiker, factoren, rollen, vernieuw, uitloggen }),
    [toestand, gebruiker, factoren, rollen, vernieuw, uitloggen],
  );

  return <AuthContext.Provider value={waarde}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthWaarde {
  const waarde = useContext(AuthContext);
  if (!waarde) throw new Error('useAuth buiten AuthProvider');
  return waarde;
}
