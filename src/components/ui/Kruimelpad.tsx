import { Link } from 'react-router';

export interface Kruimel {
  label: string;
  /** Zonder pad: de huidige pagina. */
  pad?: string;
}

/** Kruimelpad (WAI-ARIA breadcrumb): waar je bent en hoe je terug kunt. */
export function Kruimelpad({ kruimels }: { kruimels: readonly Kruimel[] }) {
  return (
    <nav aria-label="Kruimelpad" className="kruimelpad">
      <ol>
        {kruimels.map((k) => (
          <li key={k.label}>
            {k.pad ? <Link to={k.pad}>{k.label}</Link> : <span aria-current="page">{k.label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}
