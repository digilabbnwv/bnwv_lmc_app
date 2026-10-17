import type { ReactNode } from 'react';
import { Laden } from '../components/ui/Laden';
import { useAuth } from './AuthContext';
import { GeenToegang, Inloggen, TotpCode, TotpKoppelen, WachtwoordWijzigen } from './schermen';

/** Toont de app pas na een volledige inlog (wachtwoord gewijzigd, aal2, toegang). */
export function AuthPoort({ children }: { children: ReactNode }) {
  const { stap } = useAuth();
  if (stap === 'app') return <>{children}</>;
  return (
    <main id="inhoud" tabIndex={-1} className="app-inhoud app-inhoud-smal">
      <Inlogstap stap={stap} />
    </main>
  );
}

function Inlogstap({ stap }: { stap: Exclude<ReturnType<typeof useAuth>['stap'], 'app'> }) {
  switch (stap) {
    case 'laden':
      return <Laden />;
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
  }
}
