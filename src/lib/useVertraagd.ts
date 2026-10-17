import { useEffect, useState } from 'react';

/** Geeft `waarde` pas door als hij `ms` milliseconden niet is veranderd (bijv. tijdens typen). */
export function useVertraagd<T>(waarde: T, ms: number): T {
  const [vertraagd, setVertraagd] = useState(waarde);
  useEffect(() => {
    const t = setTimeout(() => {
      setVertraagd(waarde);
    }, ms);
    return () => {
      clearTimeout(t);
    };
  }, [waarde, ms]);
  return vertraagd;
}
