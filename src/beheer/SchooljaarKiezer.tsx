import {
  createContext,
  use,
  useId,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
import { huidigSchooljaar, useSchooljaren } from './data';

type Keuze = [string | null, Dispatch<SetStateAction<string | null>>];

const SchooljaarContext = createContext<Keuze | null>(null);

/**
 * Onthoudt het gekozen schooljaar tijdens het gebruik, over alle pagina's heen. Alleen in het
 * geheugen: na herladen of opnieuw inloggen start je weer bij het huidige schooljaar
 * (localStorage is alleen voor de sessie, CLAUDE.md).
 */
export function SchooljaarProvider({ children }: { children: ReactNode }) {
  const [gekozen, kies] = useState<string | null>(null);
  const waarde = useMemo<Keuze>(() => [gekozen, kies], [gekozen]);
  return <SchooljaarContext value={waarde}>{children}</SchooljaarContext>;
}

function useKeuze(): Keuze {
  const gedeeld = use(SchooljaarContext);
  // Zonder provider (bijvoorbeeld in een losse test) werkt de kiezer per scherm.
  const lokaal = useState<string | null>(null);
  return gedeeld ?? lokaal;
}

/** Het gekozen schooljaar, of anders het schooljaar van vandaag; null zolang er niets geladen is. */
export function useSchooljaarKeuze(): string | null {
  const [gekozen] = useKeuze();
  const schooljaren = useSchooljaren();
  if (gekozen && schooljaren.data?.some((s) => s.id === gekozen)) return gekozen;
  return huidigSchooljaar(schooljaren.data)?.id ?? null;
}

/** Kiest het schooljaar voor alle pagina's; standaard het schooljaar van vandaag. */
export function SchooljaarKiezer() {
  const id = useId();
  const [, kies] = useKeuze();
  const waarde = useSchooljaarKeuze();
  const schooljaren = useSchooljaren();

  return (
    <div className="veld schooljaar-kiezer">
      <label htmlFor={id} className="veld-label">
        Schooljaar
      </label>
      <select
        id={id}
        value={waarde ?? ''}
        onChange={(e) => {
          kies(e.target.value);
        }}
      >
        {(schooljaren.data ?? []).map((s) => (
          <option key={s.id} value={s.id}>
            {s.naam}
          </option>
        ))}
      </select>
    </div>
  );
}
