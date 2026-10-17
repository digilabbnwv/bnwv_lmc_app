import { useId, useRef, type ReactNode } from 'react';

export interface Tab<T extends string> {
  id: T;
  label: string;
}

interface Props<T extends string> {
  /** Toegankelijke naam van de tablist. */
  label: string;
  tabs: readonly Tab<T>[];
  actief: T;
  onKies: (id: T) => void;
  /** Inhoud van het actieve tabblad. */
  children: ReactNode;
}

/**
 * Tabbladen volgens het WAI-ARIA-patroon: Tab gaat naar het actieve tabblad, pijltjes
 * links/rechts wisselen, Home/End springen naar het eerste of laatste.
 */
export function Tabbladen<T extends string>({ label, tabs, actief, onKies, children }: Props<T>) {
  const basis = useId();
  const lijst = useRef<HTMLDivElement>(null);
  const tabId = (t: T) => `${basis}-tab-${t}`;
  const paneelId = `${basis}-paneel`;

  function kies(t: T) {
    onKies(t);
    lijst.current?.querySelector<HTMLElement>(`#${CSS.escape(tabId(t))}`)?.focus();
  }

  return (
    <>
      <div ref={lijst} role="tablist" aria-label={label} className="tabbladen">
        {tabs.map((t, i) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={tabId(t.id)}
            aria-selected={actief === t.id}
            aria-controls={paneelId}
            tabIndex={actief === t.id ? 0 : -1}
            className={actief === t.id ? 'tab actief' : 'tab'}
            onClick={() => {
              onKies(t.id);
            }}
            onKeyDown={(e) => {
              const n = tabs.length;
              const doel =
                e.key === 'ArrowRight'
                  ? tabs[(i + 1) % n]
                  : e.key === 'ArrowLeft'
                    ? tabs[(i + n - 1) % n]
                    : e.key === 'Home'
                      ? tabs[0]
                      : e.key === 'End'
                        ? tabs[n - 1]
                        : undefined;
              if (doel) {
                e.preventDefault();
                kies(doel.id);
              }
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={paneelId} aria-labelledby={tabId(actief)}>
        {children}
      </div>
    </>
  );
}
