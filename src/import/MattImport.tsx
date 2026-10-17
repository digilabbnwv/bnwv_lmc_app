// Scherm MATT-import (SPEC §8), in drie stappen: 1 bestand en periode, 2 controle
// (voorvertoning, concept), 3 verwerkt. Het bestand blijft in de browser en gaat alleen
// naar de Edge Function; het wordt nergens bewaard.
import { useId, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { huidigSchooljaar, naamVan, ophalen, useMedewerkers, useSchooljaren } from '../beheer/data';
import { useBevestig } from '../components/ui/Bevestiging';
import { Badge, Kaart, LegeStaat } from '../components/ui/Kaart';
import { Kerngetal, Kerngetallen } from '../components/ui/Kerngetal';
import { Knop } from '../components/ui/Knop';
import { Laden } from '../components/ui/Laden';
import { Melding } from '../components/ui/Melding';
import { Stappen } from '../components/ui/Stappen';
import { useToast } from '../components/ui/Toasts';
import { vertaalFout } from '../lib/fouten';
import { formatDatum, formatUren } from '../lib/opmaak';
import { functieFout, supabase } from '../lib/supabase';
import {
  actieNodig,
  bestandsgrootte,
  controleerBestand,
  controleerPeriode,
  huidigeStap,
  schooljaarTotGisteren,
  vorigeMaand,
  type Voorvertoning,
} from './logica';

export const STAPPEN = ['Bestand en periode', 'Controle', 'Verwerkt'] as const;

const STATUSNAAM = {
  concept: 'Concept',
  definitief: 'Definitief',
  teruggedraaid: 'Teruggedraaid',
} as const;

async function controleer(xml: string, van: string, tot: string): Promise<Voorvertoning> {
  const antwoord = await supabase().functions.invoke<Voorvertoning>('matt-import', {
    body: xml,
    headers: { 'Content-Type': 'application/xml', 'X-Periode-Van': van, 'X-Periode-Tot': tot },
  });
  const fout: unknown = antwoord.error;
  if (fout || !antwoord.data) throw new Error(await functieFout(fout));
  return antwoord.data;
}

function AliasToevoegen({ naam, onKlaar }: { naam: string; onKlaar: () => void }) {
  const medewerkers = useMedewerkers();
  const id = useId();
  const [keuze, setKeuze] = useState('');
  const [fout, setFout] = useState<string | null>(null);
  return (
    <form
      className="inline"
      onSubmit={(e) => {
        e.preventDefault();
        void (async () => {
          const { error } = await supabase()
            .from('medewerker_alias')
            .insert({ medewerker_id: keuze, bron: 'matt', alias: naam });
          if (error) {
            setFout(vertaalFout(error));
            return;
          }
          onKlaar();
        })();
      }}
    >
      <label htmlFor={id} className="verborgen">
        Medewerker voor {naam}
      </label>
      <select
        id={id}
        required
        value={keuze}
        onChange={(e) => {
          setKeuze(e.target.value);
        }}
      >
        <option value="">— kies medewerker —</option>
        {(medewerkers.data ?? [])
          .filter((m) => m.actief)
          .map((m) => (
            <option key={m.id} value={m.id}>
              {naamVan(m)}
            </option>
          ))}
      </select>
      <Knop type="submit" variant="secundair" disabled={!keuze}>
        Alias toevoegen
      </Knop>
      {fout ? <span role="alert">{fout}</span> : null}
    </form>
  );
}

/** Uitklapbaar blok met een telling; blokken die actie vragen staan standaard open. */
function Blok({
  titel,
  aantal,
  actie = false,
  children,
}: {
  titel: string;
  aantal: number;
  actie?: boolean;
  children: ReactNode;
}) {
  return (
    <details className="blok" open={actie}>
      <summary>
        {titel} <Badge nadruk={actie}>{aantal}</Badge>
        {actie ? <span className="gedempt">actie nodig</span> : null}
      </summary>
      <div className="blok-inhoud">{children}</div>
    </details>
  );
}

function Controle({ v, onAlias }: { v: Voorvertoning; onAlias: () => void }) {
  const medewerkers = useMedewerkers();
  const naam = new Map((medewerkers.data ?? []).map((m) => [m.id, naamVan(m)]));
  return (
    <>
      <Kerngetallen>
        <Kerngetal label="Boekingen in het bestand" waarde={String(v.bestand.regels)} />
        <Kerngetal label="Worden opgeslagen" waarde={String(v.opgeslagen.aantal)} />
        <Kerngetal label="Uren" waarde={formatUren(v.opgeslagen.uren)} eenheid="uur" />
        <Kerngetal label="Medewerkers" waarde={String(v.medewerkers.length)} />
      </Kerngetallen>

      {actieNodig(v) ? (
        <Melding soort="let-op" titel="Er is nog iets van je nodig">
          <ul className="lijst">
            {v.niet_gematcht.length > 0 ? (
              <li>
                {v.niet_gematcht_aantal} boekingen horen bij een naam zonder alias en worden niet
                opgeslagen. Koppel de naam hieronder, of laat hem staan als het geen medewerker van
                het team is.
              </li>
            ) : null}
            {v.onbekende_artikelcodes.length > 0 ? (
              <li>
                Er zijn artikelcodes zonder categorie. Vul ze aan bij{' '}
                <Link to="/beheer/artikelcodes">MATT-artikelcodes</Link>.
              </li>
            ) : null}
          </ul>
          <p>Klik daarna op &quot;Opnieuw controleren&quot;.</p>
        </Melding>
      ) : (
        <Melding soort="gelukt" titel="Alles is gekoppeld">
          Controleer de aantallen en maak de import definitief.
        </Melding>
      )}

      {v.niet_gematcht.length > 0 ? (
        <Blok titel="Namen zonder alias" aantal={v.niet_gematcht.length} actie>
          <div className="tabel-schuif">
            <table>
              <caption className="verborgen">Namen zonder alias</caption>
              <thead>
                <tr>
                  <th scope="col">Naam in MATT</th>
                  <th scope="col" className="numeriek">
                    Boekingen
                  </th>
                  <th scope="col" className="numeriek">
                    Uren
                  </th>
                  <th scope="col">Koppelen</th>
                </tr>
              </thead>
              <tbody>
                {v.niet_gematcht.map((n) => (
                  <tr key={n.naam}>
                    <th scope="row">{n.naam}</th>
                    <td className="numeriek">{n.aantal}</td>
                    <td className="numeriek">{formatUren(n.uren)}</td>
                    <td>
                      <AliasToevoegen naam={n.naam} onKlaar={onAlias} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Blok>
      ) : null}

      {v.onbekende_artikelcodes.length > 0 ? (
        <Blok titel="Artikelcodes zonder categorie" aantal={v.onbekende_artikelcodes.length} actie>
          <ul className="lijst">
            {v.onbekende_artikelcodes.map((a) => (
              <li key={a.artikelcode}>
                {a.artikelcode} ({a.aantal}×)
              </li>
            ))}
          </ul>
        </Blok>
      ) : null}

      <Blok titel="Gekoppelde medewerkers" aantal={v.medewerkers.length}>
        <div className="tabel-schuif">
          <table>
            <caption className="verborgen">Gekoppelde medewerkers</caption>
            <thead>
              <tr>
                <th scope="col">Medewerker</th>
                <th scope="col" className="numeriek">
                  Boekingen
                </th>
                <th scope="col" className="numeriek">
                  Uren
                </th>
              </tr>
            </thead>
            <tbody>
              {v.medewerkers.map((m) => (
                <tr key={m.medewerker_id}>
                  <th scope="row">{naam.get(m.medewerker_id) ?? 'Medewerker'}</th>
                  <td className="numeriek">{m.aantal}</td>
                  <td className="numeriek">{formatUren(m.uren)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Blok>

      {v.niet_gekoppelde_projecten.length > 0 ? (
        <Blok titel="MATT-projecten zonder werkpakket" aantal={v.niet_gekoppelde_projecten.length}>
          <p className="toelichting">
            Deze boekingen worden wél opgeslagen. Koppel de projecten later bij{' '}
            <Link to="/beheer/matt-projecten">MATT-projecten</Link>.
          </p>
          <div className="tabel-schuif">
            <table>
              <caption className="verborgen">MATT-projecten zonder werkpakket</caption>
              <thead>
                <tr>
                  <th scope="col">Nummer</th>
                  <th scope="col">Naam in MATT</th>
                  <th scope="col" className="numeriek">
                    Uren
                  </th>
                </tr>
              </thead>
              <tbody>
                {v.niet_gekoppelde_projecten.map((p) => (
                  <tr key={p.projectnummer}>
                    <th scope="row">{p.projectnummer}</th>
                    <td>{p.naam ?? ''}</td>
                    <td className="numeriek">{formatUren(p.uren)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Blok>
      ) : null}
    </>
  );
}

function Historie() {
  const bevestig = useBevestig();
  const toon = useToast();
  const queryClient = useQueryClient();
  const imports = useQuery({
    queryKey: ['matt_import'],
    queryFn: () =>
      ophalen(
        supabase()
          .from('matt_import')
          .select('id, tijdstip, periode_van, periode_tot, status, totaal_uren, aantallen')
          .order('tijdstip', { ascending: false })
          .limit(50),
      ),
  });
  const actie = useMutation({
    mutationFn: async ({ id, soort }: { id: string; soort: 'terugdraaien' | 'verwerpen' }) => {
      const { error } =
        soort === 'terugdraaien'
          ? await supabase().rpc('matt_import_terugdraaien', { p_import_id: id })
          : await supabase().rpc('matt_import_verwerpen', { p_import_id: id });
      if (error) throw error;
      return soort;
    },
    onSuccess: async (soort) => {
      toon(soort === 'terugdraaien' ? 'De import is teruggedraaid.' : 'Het concept is verworpen.');
      await queryClient.invalidateQueries({ queryKey: ['matt_import'] });
      await queryClient.invalidateQueries({ queryKey: ['belasting'] });
    },
  });

  return (
    <section aria-labelledby="historie-titel">
      <h3 id="historie-titel">Eerdere imports</h3>
      {actie.isError ? <Melding soort="fout">{vertaalFout(actie.error)}</Melding> : null}
      {imports.isPending ? <Laden /> : null}
      {imports.isError ? <Melding soort="fout">{vertaalFout(imports.error)}</Melding> : null}
      {imports.data && imports.data.length === 0 ? <LegeStaat titel="Nog geen imports" /> : null}
      {imports.data && imports.data.length > 0 ? (
        <div className="tabel-schuif tabel-vast">
          <table>
            <caption className="verborgen">Eerdere imports</caption>
            <thead>
              <tr>
                <th scope="col">Geïmporteerd op</th>
                <th scope="col">Periode</th>
                <th scope="col">Status</th>
                <th scope="col" className="numeriek">
                  Boekingen
                </th>
                <th scope="col" className="numeriek">
                  Uren
                </th>
                <th scope="col">
                  <span className="verborgen">Actie</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {imports.data.map((i) => {
                const aantal = (i.aantallen as { opgeslagen?: { aantal?: number } } | null)
                  ?.opgeslagen?.aantal;
                return (
                  <tr key={i.id}>
                    <td>{new Date(i.tijdstip).toLocaleString('nl-NL')}</td>
                    <td>
                      {formatDatum(i.periode_van)} – {formatDatum(i.periode_tot)}
                    </td>
                    <td>
                      <Badge nadruk={i.status === 'concept'}>{STATUSNAAM[i.status]}</Badge>
                    </td>
                    <td className="numeriek">{aantal ?? ''}</td>
                    <td className="numeriek">{formatUren(i.totaal_uren)}</td>
                    <td className="actie">
                      {i.status === 'definitief' ? (
                        <Knop
                          variant="secundair"
                          disabled={actie.isPending}
                          onClick={() => {
                            void bevestig({
                              titel: 'Import terugdraaien?',
                              tekst:
                                'De boekingen van deze import worden verwijderd. Boekingen die deze import eerder heeft vervangen, komen niet terug: importeer die periode zo nodig opnieuw.',
                              bevestigTekst: 'Terugdraaien',
                            }).then((ja) => {
                              if (ja) actie.mutate({ id: i.id, soort: 'terugdraaien' });
                            });
                          }}
                        >
                          Terugdraaien
                        </Knop>
                      ) : i.status === 'concept' ? (
                        <Knop
                          variant="secundair"
                          disabled={actie.isPending}
                          onClick={() => {
                            actie.mutate({ id: i.id, soort: 'verwerpen' });
                          }}
                        >
                          Verwerpen
                        </Knop>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

export function MattImport() {
  const bevestig = useBevestig();
  const queryClient = useQueryClient();
  const schooljaren = useSchooljaren();
  const bestandId = useId();
  const titelId = useId();
  const [bestand, setBestand] = useState<File | null>(null);
  const [van, setVan] = useState('');
  const [tot, setTot] = useState('');
  const [fout, setFout] = useState<string | null>(null);
  const [voorvertoning, setVoorvertoning] = useState<Voorvertoning | null>(null);
  const [afgerond, setAfgerond] = useState<{
    soort: 'definitief' | 'verworpen';
    aantal: number;
  } | null>(null);
  const [aliasToegevoegd, setAliasToegevoegd] = useState(false);
  const xml = useRef<string | null>(null);
  const stapTitel = useRef<HTMLHeadingElement>(null);

  const stap = huidigeStap(voorvertoning, afgerond !== null);
  const vandaag = new Date();
  const schooljaar = huidigSchooljaar(schooljaren.data);
  const ditSchooljaar = schooljaar ? schooljaarTotGisteren(schooljaar, vandaag) : null;

  const vernieuwHistorie = () => queryClient.invalidateQueries({ queryKey: ['matt_import'] });
  const naarStap = () => {
    // Na een stapwissel: focus naar de kop van de nieuwe stap.
    setTimeout(() => stapTitel.current?.focus(), 0);
  };

  const controleren = useMutation({
    mutationFn: async () => {
      // Een eerder concept uit deze sessie eerst opruimen.
      if (voorvertoning) {
        await supabase().rpc('matt_import_verwerpen', { p_import_id: voorvertoning.import_id });
      }
      if (!xml.current && bestand) xml.current = await bestand.text();
      return controleer(xml.current ?? '', van, tot);
    },
    onSuccess: async (v) => {
      setVoorvertoning(v);
      setAliasToegevoegd(false);
      setFout(null);
      naarStap();
      await vernieuwHistorie();
    },
    onError: (e) => {
      setVoorvertoning(null);
      setFout(e.message);
    },
  });

  const afronden = useMutation({
    mutationFn: async (soort: 'definitief' | 'verwerpen') => {
      if (!voorvertoning) return soort;
      const { error } =
        soort === 'definitief'
          ? await supabase().rpc('matt_import_definitief_maken', {
              p_import_id: voorvertoning.import_id,
            })
          : await supabase().rpc('matt_import_verwerpen', { p_import_id: voorvertoning.import_id });
      if (error) throw error;
      return soort;
    },
    onSuccess: async (soort) => {
      setAfgerond({
        soort: soort === 'definitief' ? 'definitief' : 'verworpen',
        aantal: voorvertoning?.opgeslagen.aantal ?? 0,
      });
      setVoorvertoning(null);
      setBestand(null);
      xml.current = null;
      naarStap();
      await vernieuwHistorie();
      await queryClient.invalidateQueries({ queryKey: ['belasting'] });
    },
    onError: (e) => {
      setFout(vertaalFout(e));
    },
  });

  function opnieuwBeginnen() {
    setAfgerond(null);
    setFout(null);
    setVan('');
    setTot('');
    naarStap();
  }

  return (
    <section aria-labelledby={titelId}>
      <h2 id={titelId}>MATT-import</h2>
      <p className="toelichting">
        Upload de export &quot;Project uren per projectmanager status&quot; (XML) en geef de periode
        op waarover de export gaat. Het bestand wordt alleen gecontroleerd en verwerkt, niet
        bewaard.
      </p>

      <Stappen stappen={STAPPEN} huidig={stap} />
      <h3 ref={stapTitel} tabIndex={-1}>
        Stap {stap} van {STAPPEN.length}: {STAPPEN[stap - 1]}
      </h3>

      {fout ? <Melding soort="fout">{fout}</Melding> : null}

      {stap === 1 ? (
        <Kaart>
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              const probleem = controleerBestand(bestand) ?? controleerPeriode(van, tot);
              if (probleem) {
                setFout(probleem);
                return;
              }
              controleren.mutate();
            }}
          >
            <div className="veld">
              <label htmlFor={bestandId} className="veld-label">
                MATT-export (XML, maximaal 10 MB)
              </label>
              <input
                id={bestandId}
                type="file"
                accept=".xml,text/xml,application/xml"
                onChange={(e) => {
                  setBestand(e.target.files?.[0] ?? null);
                  xml.current = null;
                }}
              />
              {bestand ? (
                <p className="bestand-info">
                  Gekozen: {bestand.name} · {bestandsgrootte(bestand.size)}
                </p>
              ) : null}
            </div>
            <fieldset className="veldgroep">
              <legend>Periode van de export</legend>
              <div className="periode-velden">
                <label>
                  Vanaf
                  <input
                    type="date"
                    required
                    value={van}
                    onChange={(e) => {
                      setVan(e.target.value);
                    }}
                  />
                </label>
                <label>
                  Tot en met
                  <input
                    type="date"
                    required
                    value={tot}
                    onChange={(e) => {
                      setTot(e.target.value);
                    }}
                  />
                </label>
              </div>
              <div className="knoppen">
                <Knop
                  variant="secundair"
                  onClick={() => {
                    const p = vorigeMaand(new Date());
                    setVan(p.van);
                    setTot(p.tot);
                  }}
                >
                  Vorige maand
                </Knop>
                {ditSchooljaar ? (
                  <Knop
                    variant="secundair"
                    onClick={() => {
                      setVan(ditSchooljaar.van);
                      setTot(ditSchooljaar.tot);
                    }}
                  >
                    Dit schooljaar t/m gisteren
                  </Knop>
                ) : null}
              </div>
            </fieldset>
            <div className="knoppen">
              <Knop type="submit" bezig={controleren.isPending}>
                Controleren
              </Knop>
            </div>
          </form>
        </Kaart>
      ) : null}

      {stap === 2 && voorvertoning ? (
        <>
          <p className="gedempt">
            {bestand?.name ?? 'Bestand'} · periode {formatDatum(van)} – {formatDatum(tot)} · dit is
            nog een concept.
          </p>
          {aliasToegevoegd ? (
            <Melding soort="gelukt">
              Alias toegevoegd. Klik op &quot;Opnieuw controleren&quot; om de boekingen mee te
              nemen.
            </Melding>
          ) : null}
          <Controle
            v={voorvertoning}
            onAlias={() => {
              setAliasToegevoegd(true);
            }}
          />
          <div className="knoppen">
            <Knop
              bezig={afronden.isPending && afronden.variables === 'definitief'}
              disabled={afronden.isPending || controleren.isPending}
              onClick={() => {
                void bevestig({
                  titel: 'Import definitief maken?',
                  tekst:
                    'Bestaande boekingen van deze medewerkers in deze periode worden vervangen door de boekingen uit dit bestand.',
                  bevestigTekst: 'Definitief maken',
                }).then((ja) => {
                  if (ja) afronden.mutate('definitief');
                });
              }}
            >
              Definitief maken
            </Knop>
            <Knop
              variant="secundair"
              bezig={controleren.isPending}
              disabled={afronden.isPending}
              onClick={() => {
                controleren.mutate();
              }}
            >
              Opnieuw controleren
            </Knop>
            <Knop
              variant="secundair"
              disabled={afronden.isPending || controleren.isPending}
              onClick={() => {
                afronden.mutate('verwerpen');
              }}
            >
              Verwerpen
            </Knop>
          </div>
        </>
      ) : null}

      {stap === 3 && afgerond ? (
        <>
          {afgerond.soort === 'definitief' ? (
            <Melding soort="gelukt" titel="De import is definitief">
              <p>
                {afgerond.aantal} boekingen zijn verwerkt. Bekijk het resultaat bij{' '}
                <Link to="/team">Teamoverzicht</Link> of{' '}
                <Link to="/gepland-gerealiseerd">Gepland en gerealiseerd</Link>.
              </p>
            </Melding>
          ) : (
            <Melding titel="Het concept is verworpen">Er is niets opgeslagen.</Melding>
          )}
          <Knop onClick={opnieuwBeginnen}>Nieuwe import</Knop>
        </>
      ) : null}

      <Historie />
    </section>
  );
}
