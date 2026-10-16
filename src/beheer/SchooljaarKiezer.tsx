import { useEffect, useId } from 'react';
import { huidigSchooljaar, useSchooljaren } from './data';

/** Kiest een schooljaar; standaard het schooljaar van vandaag. */
export function SchooljaarKiezer({
  waarde,
  onWijzig,
}: {
  waarde: string | null;
  onWijzig: (id: string) => void;
}) {
  const id = useId();
  const schooljaren = useSchooljaren();
  const standaard = huidigSchooljaar(schooljaren.data);

  useEffect(() => {
    if (waarde === null && standaard) onWijzig(standaard.id);
  }, [waarde, standaard, onWijzig]);

  return (
    <div className="veld schooljaar-kiezer">
      <label htmlFor={id} className="veld-label">
        Schooljaar
      </label>
      <select
        id={id}
        value={waarde ?? ''}
        onChange={(e) => {
          onWijzig(e.target.value);
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
