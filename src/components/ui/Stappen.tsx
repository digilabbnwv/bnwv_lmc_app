/**
 * Stappenindicator voor een stroom van een paar stappen. De huidige stap heeft
 * aria-current="step"; afgeronde stappen zeggen "(klaar)" voor schermlezers. De stap staat
 * ook als tekst in beeld, dus niet alleen in vorm of kleur.
 */
export function Stappen({ stappen, huidig }: { stappen: readonly string[]; huidig: number }) {
  return (
    <ol className="stappen" aria-label="Stappen">
      {stappen.map((naam, i) => {
        const nummer = i + 1;
        const status = nummer < huidig ? 'klaar' : nummer === huidig ? 'huidig' : 'nog';
        return (
          <li
            key={naam}
            className={`stap stap-${status}`}
            aria-current={status === 'huidig' ? 'step' : undefined}
          >
            <span className="stap-nummer" aria-hidden="true">
              {status === 'klaar' ? '✓' : nummer}
            </span>
            <span className="stap-naam">
              {naam}
              {status === 'klaar' ? <span className="verborgen"> (klaar)</span> : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
