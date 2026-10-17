import {
  createContext,
  use,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { PictogramKnop } from './Knop';

/** Hoe lang een toast blijft staan (ms). Ruim, en je kunt hem ook zelf sluiten. */
export const TOAST_DUUR = 8000;

interface Toast {
  id: number;
  tekst: string;
}

type Toon = (tekst: string) => void;

const ToastContext = createContext<Toon | null>(null);

/**
 * Korte bevestigingen ("Opgeslagen") rechtsonder. De lijst is een live-regio die altijd in
 * de DOM staat, zodat schermlezers nieuwe meldingen voorlezen (WCAG 4.1.3).
 * Gebruik voor fouten een Melding in de pagina, geen toast.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const volgende = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const sluit = useCallback((id: number) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setToasts((lijst) => lijst.filter((t) => t.id !== id));
  }, []);

  const toon = useCallback<Toon>(
    (tekst) => {
      const id = volgende.current++;
      setToasts((lijst) => [...lijst, { id, tekst }]);
      timers.current.set(
        id,
        setTimeout(() => {
          sluit(id);
        }, TOAST_DUUR),
      );
    },
    [sluit],
  );

  useEffect(() => {
    const lopend = timers.current;
    return () => {
      for (const t of lopend.values()) clearTimeout(t);
    };
  }, []);

  return (
    <ToastContext value={toon}>
      {children}
      <ol className="toasts" aria-live="polite" aria-label="Meldingen">
        {toasts.map((t) => (
          <li key={t.id} className="toast">
            <span className="toast-tekst">{t.tekst}</span>
            <PictogramKnop
              pictogram="sluiten"
              label="Melding sluiten"
              onClick={() => {
                sluit(t.id);
              }}
            />
          </li>
        ))}
      </ol>
    </ToastContext>
  );
}

export function useToast(): Toon {
  const toon = use(ToastContext);
  if (!toon) throw new Error('useToast buiten ToastProvider');
  return toon;
}
