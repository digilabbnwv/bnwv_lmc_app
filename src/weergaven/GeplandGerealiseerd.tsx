// Gepland versus gerealiseerd (SPEC §9), per medewerker en schooljaar: per categorie,
// per werkpakket, niet-gekoppelde uren apart, en "tot vandaag". Neutraal: een verschil
// is geen beoordeling.
import { Link, useNavigate, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import { rechtenVoor } from '../auth/rechten';
import { naamVan, useMedewerkers } from '../beheer/data';
import { SchooljaarKiezer, useSchooljaarKeuze } from '../beheer/SchooljaarKiezer';
import { Kaart, LegeStaat } from '../components/ui/Kaart';
import { Kruimelpad } from '../components/ui/Kruimelpad';
import { Laden } from '../components/ui/Laden';
import { Melding } from '../components/ui/Melding';
import { vertaalFout } from '../lib/fouten';
import { formatUren } from '../lib/opmaak';
import { haalVergelijking } from './data';
import { nietGekoppeld, perCategorie, perWerkpakket, verschil, type Totaal } from './logica';
import { TabelVak } from '../components/ui/TabelVak';

function Vergelijktabel({ titel, rijen, kop }: { titel: string; rijen: Totaal[]; kop: string }) {
  return (
    <TabelVak label={titel}>
      <table>
        <caption className="verborgen">{titel}</caption>
        <thead>
          <tr>
            <th scope="col" rowSpan={2}>
              {kop}
            </th>
            <th scope="colgroup" colSpan={3}>
              Hele schooljaar
            </th>
            <th scope="colgroup" colSpan={3}>
              Tot vandaag
            </th>
          </tr>
          <tr>
            <th scope="col" className="numeriek">
              Gepland
            </th>
            <th scope="col" className="numeriek">
              Gerealiseerd
            </th>
            <th scope="col" className="numeriek">
              Verschil
            </th>
            <th scope="col" className="numeriek">
              Gepland
            </th>
            <th scope="col" className="numeriek">
              Gerealiseerd
            </th>
            <th scope="col" className="numeriek">
              Verschil
            </th>
          </tr>
        </thead>
        <tbody>
          {rijen.map((r) => (
            <tr key={r.sleutel}>
              <th scope="row">
                {r.naam}
                {r.sleutel === 'relatiebeheer' && r.gepland === 0 ? (
                  <span className="toelichting"> (niet gepland)</span>
                ) : null}
              </th>
              <td className="numeriek">{formatUren(r.gepland)}</td>
              <td className="numeriek">{formatUren(r.gerealiseerd)}</td>
              <td className="numeriek">{verschil(r.gerealiseerd, r.gepland)}</td>
              <td className="numeriek">{formatUren(r.geplandTot)}</td>
              <td className="numeriek">{formatUren(r.gerealiseerdTot)}</td>
              <td className="numeriek">{verschil(r.gerealiseerdTot, r.geplandTot)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </TabelVak>
  );
}

/**
 * Eén categorie in cijfers. "Tot vandaag" bewust alleen als getallen, zonder balk: een
 * balk nodigt uit tot een vergelijking die als oordeel gelezen wordt (doelbinding, SPEC §1).
 */
function CategorieKaart({ t }: { t: Totaal }) {
  return (
    <Kaart titel={t.naam}>
      <dl>
        <dt>Gepland</dt>
        <dd>{formatUren(t.gepland)} uur</dd>
        <dt>Gerealiseerd</dt>
        <dd>{formatUren(t.gerealiseerd)} uur</dd>
      </dl>
      <p className="categoriekaart-tot">
        Tot vandaag: {formatUren(t.gerealiseerdTot)} uur geboekt, {formatUren(t.geplandTot)} uur
        gepland.
        {t.sleutel === 'relatiebeheer' && t.gepland === 0 ? (
          <span className="gedempt"> Relatiebeheer wordt niet vooraf gepland.</span>
        ) : null}
      </p>
    </Kaart>
  );
}

export function GeplandGerealiseerd() {
  const { medewerkerId: eigenId, rollen } = useAuth();
  const { medewerkerId: gekozen } = useParams();
  const navigate = useNavigate();
  const rechten = rechtenVoor(rollen);
  const schooljaar = useSchooljaarKeuze();
  const medewerkers = useMedewerkers();
  // Een lmc ziet altijd alleen zichzelf (RLS dwingt dat ook af).
  const medewerker = rechten.werkInzien ? (gekozen ?? eigenId) : eigenId;

  const rijen = useQuery({
    queryKey: ['belasting', 'vergelijk', schooljaar, medewerker],
    enabled: schooljaar !== null && medewerker !== null,
    queryFn: () => haalVergelijking(medewerker ?? '', schooljaar ?? ''),
  });

  const data = rijen.data ?? [];
  const gevonden = (medewerkers.data ?? []).find((m) => m.id === medewerker);
  const medewerkerNaam = gevonden ? naamVan(gevonden) : null;
  const los = nietGekoppeld(data);

  return (
    <section aria-labelledby="vergelijk-titel">
      {gekozen && rechten.werkInzien ? (
        <Kruimelpad
          kruimels={[
            { label: 'Teamoverzicht', pad: '/team' },
            { label: medewerkerNaam ?? 'Medewerker' },
          ]}
        />
      ) : null}
      <h2 id="vergelijk-titel">Gepland en gerealiseerd</h2>
      <p className="toelichting">
        Gepland komt uit de toewijzingen; gerealiseerd uit de definitieve MATT-imports. &quot;Tot
        vandaag&quot; vergelijkt het deel van de planning tot vandaag met wat tot vandaag is
        geboekt.
      </p>
      <div className="overzicht-balk">
        <SchooljaarKiezer />
        {rechten.werkInzien ? (
          <label className="veld">
            <span className="veld-label">Medewerker</span>
            <select
              value={medewerker ?? ''}
              onChange={(e) => {
                void navigate(`/gepland-gerealiseerd/${e.target.value}`);
              }}
            >
              {(medewerkers.data ?? []).map((m) => (
                <option key={m.id} value={m.id}>
                  {naamVan(m)}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {medewerker === null ? (
        <Melding soort="let-op" titel="Geen medewerker gekoppeld">
          Je account is niet aan een medewerker gekoppeld. Vraag een manager of beheerder om dat te
          doen.
        </Melding>
      ) : null}
      {rijen.isPending && schooljaar && medewerker ? <Laden /> : null}
      {rijen.isError ? <Melding soort="fout">{vertaalFout(rijen.error)}</Melding> : null}
      {rijen.data ? (
        <>
          <h3>Per categorie</h3>
          <div className="categoriekaarten">
            {perCategorie(data).map((t) => (
              <CategorieKaart key={t.sleutel} t={t} />
            ))}
          </div>
          <details className="details-tabel">
            <summary>Per categorie als tabel tonen</summary>
            <Vergelijktabel titel="Per categorie" kop="Categorie" rijen={perCategorie(data)} />
          </details>

          <h3>Per werkpakket</h3>
          {perWerkpakket(data).length > 0 ? (
            <Vergelijktabel titel="Per werkpakket" kop="Werkpakket" rijen={perWerkpakket(data)} />
          ) : (
            <LegeStaat titel="Geen gekoppelde werkpakketten">
              In dit schooljaar zijn er geen werkpakketten met geplande of geboekte uren.
            </LegeStaat>
          )}

          <Melding titel="Niet gekoppeld">
            Uren op MATT-projecten die nog niet aan een werkpakket zijn gekoppeld:{' '}
            <strong>{formatUren(los.gerealiseerd)} uur</strong>.
            {los.gerealiseerd > 0 && rechten.mattProjecten ? (
              <>
                {' '}
                <Link to="/beheer/matt-projecten">MATT-projecten koppelen</Link>
              </>
            ) : null}
          </Melding>
        </>
      ) : null}
    </section>
  );
}
