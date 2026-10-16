import type { ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { GeenToegang, Inloggen, TotpCode, TotpKoppelen, WachtwoordWijzigen } from './schermen';

/** Toont de app pas na een volledige inlog (wachtwoord gewijzigd, aal2, toegang). */
export function AuthPoort({ children }: { children: ReactNode }) {
  const { stap } = useAuth();
  switch (stap) {
    case 'laden':
      return <p aria-busy="true">Bezig met laden…</p>;
    case 'inloggen':
      return <Inloggen />;
    case 'totp_code':
      return <TotpCode />;
    case 'wachtwoord':
      return <WachtwoordWijzigen />;
    case 'totp_koppelen':
      return <TotpKoppelen />;
    case 'geen_toegang':
      return <GeenToegang />;
    case 'app':
      return <>{children}</>;
  }
}
