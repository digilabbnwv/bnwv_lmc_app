import { Link, Route, Routes } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { rechtenVoor } from '../auth/rechten';
import {
  Artikelcodes,
  Feestdagen,
  Instellingen,
  Opslagfactoren,
  Schooljaren,
  Schoolvakanties,
  Staffels,
} from './configuratie';
import { MedewerkerDetail, Medewerkers } from './medewerkers';
import { Toewijzingen } from './toewijzingen';
import {
  Activiteiten,
  Activiteittypes,
  Leerlingen,
  MattProjecten,
  Projecten,
  Scholen,
} from './werk';

interface Onderdeel {
  pad: string;
  naam: string;
  groep: 'Configuratie' | 'Medewerkers' | 'Werk' | 'Toewijzingen';
  zichtbaar: boolean;
  element: React.ReactNode;
}

/** Alle beheeronderdelen, met de rechten uit SPEC §6. */
export function useOnderdelen(): Onderdeel[] {
  const { rollen } = useAuth();
  const r = rechtenVoor(rollen);
  const c = r.configuratie;
  const w = r.werkBeheren;
  return [
    {
      pad: 'schooljaren',
      naam: 'Schooljaren',
      groep: 'Configuratie',
      zichtbaar: c,
      element: <Schooljaren magBewerken={c} />,
    },
    {
      pad: 'schoolvakanties',
      naam: 'Schoolvakanties',
      groep: 'Configuratie',
      zichtbaar: c,
      element: <Schoolvakanties magBewerken={c} />,
    },
    {
      pad: 'feestdagen',
      naam: 'Feestdagen',
      groep: 'Configuratie',
      zichtbaar: c,
      element: <Feestdagen magBewerken={c} />,
    },
    {
      pad: 'staffel',
      naam: 'Staffel',
      groep: 'Configuratie',
      zichtbaar: c,
      element: <Staffels magBewerken={c} />,
    },
    {
      pad: 'opslagfactoren',
      naam: 'Opslagfactoren',
      groep: 'Configuratie',
      zichtbaar: c,
      element: <Opslagfactoren magBewerken={c} />,
    },
    {
      pad: 'instellingen',
      naam: 'Instellingen',
      groep: 'Configuratie',
      zichtbaar: c,
      element: <Instellingen magBewerken={c} />,
    },
    {
      pad: 'artikelcodes',
      naam: 'MATT-artikelcodes',
      groep: 'Configuratie',
      zichtbaar: c,
      element: <Artikelcodes magBewerken={c} />,
    },
    {
      pad: 'medewerkers',
      naam: 'Medewerkers',
      groep: 'Medewerkers',
      zichtbaar: r.medewerkers,
      element: <Medewerkers magBewerken={r.medewerkers} />,
    },
    {
      pad: 'scholen',
      naam: 'Scholen',
      groep: 'Werk',
      zichtbaar: r.werkInzien,
      element: <Scholen magBewerken={w} />,
    },
    {
      pad: 'leerlingen',
      naam: 'Leerlingen per schooljaar',
      groep: 'Werk',
      zichtbaar: r.werkInzien,
      element: <Leerlingen magBewerken={w} />,
    },
    {
      pad: 'activiteittypes',
      naam: 'Activiteittypes',
      groep: 'Werk',
      zichtbaar: r.werkInzien,
      element: <Activiteittypes magBewerken={w} />,
    },
    {
      pad: 'activiteiten',
      naam: 'Activiteiten',
      groep: 'Werk',
      zichtbaar: r.werkInzien,
      element: <Activiteiten magBewerken={w} />,
    },
    {
      pad: 'projecten',
      naam: 'Projecten',
      groep: 'Werk',
      zichtbaar: r.werkInzien,
      element: <Projecten magBewerken={w} />,
    },
    {
      pad: 'matt-projecten',
      naam: 'MATT-projecten',
      groep: 'Werk',
      zichtbaar: r.mattProjecten,
      element: <MattProjecten magBewerken={r.mattProjecten} />,
    },
    {
      pad: 'toewijzingen',
      naam: 'Toewijzingen',
      groep: 'Toewijzingen',
      zichtbaar: r.werkInzien,
      element: <Toewijzingen magBewerken={w} />,
    },
  ];
}

function Overzicht() {
  const onderdelen = useOnderdelen().filter((o) => o.zichtbaar);
  const groepen = [...new Set(onderdelen.map((o) => o.groep))];
  return (
    <nav aria-labelledby="beheer-titel">
      <h2 id="beheer-titel">Beheer</h2>
      {groepen.map((g) => (
        <section key={g} aria-label={g}>
          <h3>{g}</h3>
          <ul className="lijst">
            {onderdelen
              .filter((o) => o.groep === g)
              .map((o) => (
                <li key={o.pad}>
                  <Link to={`/beheer/${o.pad}`}>{o.naam}</Link>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </nav>
  );
}

export default function BeheerRoutes() {
  const onderdelen = useOnderdelen();
  const { rollen } = useAuth();
  const r = rechtenVoor(rollen);
  return (
    <Routes>
      <Route index element={<Overzicht />} />
      {onderdelen
        .filter((o) => o.zichtbaar)
        .map((o) => (
          <Route
            key={o.pad}
            path={o.pad}
            element={
              <>
                <p>
                  <Link to="/beheer">← Beheer</Link>
                </p>
                <h2>{o.naam}</h2>
                {o.element}
              </>
            }
          />
        ))}
      {r.medewerkers ? (
        <Route path="medewerkers/:id" element={<MedewerkerDetail magBewerken={r.medewerkers} />} />
      ) : null}
      <Route path="*" element={<p>Deze pagina bestaat niet of je hebt er geen toegang toe.</p>} />
    </Routes>
  );
}
