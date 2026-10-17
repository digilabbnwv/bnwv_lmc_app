import type { ReactNode } from 'react';
import { Link, Route, Routes } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { rechtenVoor } from '../auth/rechten';
import { Kaart } from '../components/ui/Kaart';
import { Kruimelpad } from '../components/ui/Kruimelpad';
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
import { GROEPEN, ONDERDELEN } from './onderdelen';
import { Toewijzingen } from './toewijzingen';
import {
  Activiteiten,
  Activiteittypes,
  Leerlingen,
  MattProjecten,
  Projecten,
  Scholen,
} from './werk';

/** Het scherm per onderdeel (zie onderdelen.ts voor naam, uitleg en rechten). */
const SCHERMEN: Record<string, (magBewerken: boolean) => ReactNode> = {
  schooljaren: (m) => <Schooljaren magBewerken={m} />,
  schoolvakanties: (m) => <Schoolvakanties magBewerken={m} />,
  feestdagen: (m) => <Feestdagen magBewerken={m} />,
  staffel: (m) => <Staffels magBewerken={m} />,
  opslagfactoren: (m) => <Opslagfactoren magBewerken={m} />,
  instellingen: (m) => <Instellingen magBewerken={m} />,
  artikelcodes: (m) => <Artikelcodes magBewerken={m} />,
  medewerkers: (m) => <Medewerkers magBewerken={m} />,
  scholen: (m) => <Scholen magBewerken={m} />,
  leerlingen: (m) => <Leerlingen magBewerken={m} />,
  activiteittypes: (m) => <Activiteittypes magBewerken={m} />,
  activiteiten: (m) => <Activiteiten magBewerken={m} />,
  projecten: (m) => <Projecten magBewerken={m} />,
  'matt-projecten': (m) => <MattProjecten magBewerken={m} />,
  toewijzingen: (m) => <Toewijzingen magBewerken={m} />,
};

function useRechten() {
  const { rollen } = useAuth();
  return rechtenVoor(rollen);
}

function Overzicht() {
  const r = useRechten();
  const zichtbaar = ONDERDELEN.filter((o) => o.zichtbaar(r));
  return (
    <section aria-labelledby="beheer-titel">
      <h2 id="beheer-titel">Beheer</h2>
      <p className="gedempt">Kies wat je wilt inzien of bijwerken.</p>
      <div className="beheer-groepen">
        {GROEPEN.filter((g) => zichtbaar.some((o) => o.groep === g)).map((g) => (
          <Kaart key={g} titel={g}>
            <ul className="beheer-onderdelen">
              {zichtbaar
                .filter((o) => o.groep === g)
                .map((o) => (
                  <li key={o.pad}>
                    <Link to={`/beheer/${o.pad}`}>
                      <span className="beheer-onderdeel-naam">{o.naam}</span>
                      <span className="beheer-onderdeel-uitleg">{o.omschrijving}</span>
                    </Link>
                  </li>
                ))}
            </ul>
          </Kaart>
        ))}
      </div>
    </section>
  );
}

export default function BeheerRoutes() {
  const r = useRechten();
  return (
    <Routes>
      <Route index element={<Overzicht />} />
      {ONDERDELEN.filter((o) => o.zichtbaar(r)).map((o) => (
        <Route
          key={o.pad}
          path={o.pad}
          element={
            <>
              <Kruimelpad kruimels={[{ label: 'Beheer', pad: '/beheer' }, { label: o.naam }]} />
              <h2>{o.naam}</h2>
              {SCHERMEN[o.pad]?.(o.magBewerken(r))}
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
