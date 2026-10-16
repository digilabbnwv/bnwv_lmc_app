// Bepaalt welke stap van de inlogstroom nodig is (SPEC §7).

export type Stap =
  'laden' | 'inloggen' | 'totp_code' | 'wachtwoord' | 'totp_koppelen' | 'geen_toegang' | 'app';

export interface AuthToestand {
  geladen: boolean;
  sessie: boolean;
  aal: 'aal1' | 'aal2' | null;
  heeftGeverifieerdeFactor: boolean;
  moetWachtwoordWijzigen: boolean;
  heeftToegangNaMfa: boolean;
}

export function bepaalStap(t: AuthToestand): Stap {
  if (!t.geladen) return 'laden';
  if (!t.sessie) return 'inloggen';
  // Met een gekoppeld toestel eerst de code: Supabase staat een wachtwoordwijziging
  // dan pas op aal2 toe.
  if (t.aal !== 'aal2' && t.heeftGeverifieerdeFactor) return 'totp_code';
  if (t.moetWachtwoordWijzigen) return 'wachtwoord';
  if (!t.heeftGeverifieerdeFactor) return 'totp_koppelen';
  if (t.aal !== 'aal2') return 'totp_code';
  if (!t.heeftToegangNaMfa) return 'geen_toegang';
  return 'app';
}
