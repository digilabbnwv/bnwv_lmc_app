import { useEffect, useRef } from 'react';

export const INACTIVITEIT_MS = 30 * 60 * 1000;

const GEBEURTENISSEN = ['pointerdown', 'keydown', 'mousemove', 'scroll', 'touchstart'] as const;

/** Roept onVerlopen aan na `ms` milliseconden zonder activiteit (alleen als actief). */
export function useInactiviteit(actief: boolean, onVerlopen: () => void, ms = INACTIVITEIT_MS) {
  const terugroep = useRef(onVerlopen);
  useEffect(() => {
    terugroep.current = onVerlopen;
  }, [onVerlopen]);

  useEffect(() => {
    if (!actief) return;
    let timer = window.setTimeout(() => {
      terugroep.current();
    }, ms);
    const herstart = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        terugroep.current();
      }, ms);
    };
    for (const g of GEBEURTENISSEN) window.addEventListener(g, herstart, { passive: true });
    return () => {
      window.clearTimeout(timer);
      for (const g of GEBEURTENISSEN) window.removeEventListener(g, herstart);
    };
  }, [actief, ms]);
}
