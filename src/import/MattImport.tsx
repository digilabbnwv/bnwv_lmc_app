// Scherm MATT-import (SPEC §8): uploaden, periode opgeven, voorvertoning, definitief
// maken, verwerpen en terugdraaien. Het bestand blijft in de browser en gaat alleen
// naar de Edge Function; het wordt nergens bewaard.
import { useId, useRef, useState } from 'react';
import { Link } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { naamVan, ophalen, useMedewerkers } from '../beheer/data';
import { functieFout, supabase } from '../lib/supabase';
import { vertaalFout } from '../lib/fouten';
import { formatDatum, formatUren } from '../lib/opmaak';
import { useBevestig } from '../components/ui/Bevestiging';
import { controleerBestand, controleerPeriode, samenvatting, type Voorvertoning } from './logica';

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
      <button type="submit" className="secundair" disabled={!keuze}>
        Alias toevoegen
      </button>
      {fout ? <span role="alert">{fout}</span> : null}
    </form>
  );
}

function VoorvertoningWeergave({ v, onAlias }: { v: Voorvertoning; onAlias: () => void }) {
  const medewerkers = useMedewerkers();
  const naam = new Map((medewerkers.data ?? []).map((m) => [m.id, naamVan(m)]));
  return (
    <>
      <ul className="lijst">
        {samenvatting(v).map((z) => (
          <li key={z}>{z}</li>
        ))}
      </ul>

      <h4>Gekoppelde medewerkers</h4>
      <table>
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
              <td>{naam.get(m.medewerker_id) ?? 'Medewerker'}</td>
              <td className="numeriek">{m.aantal}</td>
              <td className="numeriek">{formatUren(m.uren)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {v.niet_gematcht.length > 0 ? (
        <>
          <h4>Namen zonder alias (worden niet opgeslagen)</h4>
          <p className="toelichting">
            Koppel een naam aan een medewerker en controleer daarna opnieuw. Komt de naam niet van
            een medewerker van het team, laat hem dan staan.
          </p>
          <table>
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
                  <td>{n.naam}</td>
                  <td className="numeriek">{n.aantal}</td>
                  <td className="numeriek">{formatUren(n.uren)}</td>
                  <td>
                    <AliasToevoegen naam={n.naam} onKlaar={onAlias} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}

      {v.niet_gekoppelde_projecten.length > 0 ? (
        <>
          <h4>MATT-projecten zonder werkpakket</h4>
          <p className="toelichting">
            Deze boekingen worden wél opgeslagen. Koppel de projecten bij{' '}
            <Link to="/beheer/matt-projecten">MATT-projecten</Link>.
          </p>
          <table>
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
                  <td>{p.projectnummer}</td>
                  <td>{p.naam ?? ''}</td>
                  <td className="numeriek">{formatUren(p.uren)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}

      {v.onbekende_artikelcodes.length > 0 ? (
        <p role="note">
          Artikelcodes zonder categorie:{' '}
          {v.onbekende_artikelcodes
            .map((a) => `${a.artikelcode} (${String(a.aantal)}×)`)
            .join(', ')}
          . Vul ze aan bij <Link to="/beheer/artikelcodes">MATT-artikelcodes</Link>.
        </p>
      ) : null}
    </>
  );
}

function Historie() {
  const bevestig = useBevestig();
  const queryClient = useQueryClient();
  const [melding, setMelding] = useState<string | null>(null);
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
      setMelding(
        soort === 'terugdraaien' ? 'De import is teruggedraaid.' : 'Het concept is verworpen.',
      );
      await queryClient.invalidateQueries({ queryKey: ['matt_import'] });
    },
    onError: (e) => {
      setMelding(vertaalFout(e));
    },
  });

  return (
    <section aria-labelledby="historie-titel">
      <h3 id="historie-titel">Eerdere imports</h3>
      <p role="status" aria-live="polite">
        {melding ?? ''}
      </p>
      {imports.data ? (
        <div className="tabel-schuif">
          <table>
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
                    <td>{STATUSNAAM[i.status]}</td>
                    <td className="numeriek">{aantal ?? ''}</td>
                    <td className="numeriek">{formatUren(i.totaal_uren)}</td>
                    <td>
                      {i.status === 'definitief' ? (
                        <button
                          type="button"
                          className="secundair"
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
                        </button>
                      ) : i.status === 'concept' ? (
                        <button
                          type="button"
                          className="secundair"
                          disabled={actie.isPending}
                          onClick={() => {
                            actie.mutate({ id: i.id, soort: 'verwerpen' });
                          }}
                        >
                          Verwerpen
                        </button>
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
  const bestandId = useId();
  const [bestand, setBestand] = useState<File | null>(null);
  const [van, setVan] = useState('');
  const [tot, setTot] = useState('');
  const [fout, setFout] = useState<string | null>(null);
  const [melding, setMelding] = useState<string | null>(null);
  const [voorvertoning, setVoorvertoning] = useState<Voorvertoning | null>(null);
  const xml = useRef<string | null>(null);

  const vernieuwHistorie = () => queryClient.invalidateQueries({ queryKey: ['matt_import'] });

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
      setFout(null);
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
      setMelding(soort === 'definitief' ? 'De import is definitief.' : 'Het concept is verworpen.');
      setVoorvertoning(null);
      setBestand(null);
      xml.current = null;
      await vernieuwHistorie();
      await queryClient.invalidateQueries({ queryKey: ['belasting'] });
    },
    onError: (e) => {
      setFout(vertaalFout(e));
    },
  });

  return (
    <section aria-labelledby="import-titel">
      <h2 id="import-titel">MATT-import</h2>
      <p className="toelichting">
        Upload de export &quot;Project uren per projectmanager status&quot; (XML) en geef de periode
        op waarover de export gaat. Het bestand wordt alleen gecontroleerd en verwerkt, niet
        bewaard.
      </p>

      <form
        className="kader"
        onSubmit={(e) => {
          e.preventDefault();
          setMelding(null);
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
              setVoorvertoning(null);
            }}
          />
        </div>
        <label>
          Periode vanaf
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
          Periode tot en met
          <input
            type="date"
            required
            value={tot}
            onChange={(e) => {
              setTot(e.target.value);
            }}
          />
        </label>
        <p className="melding" role="alert">
          {fout ?? ''}
        </p>
        <button type="submit" disabled={controleren.isPending}>
          {voorvertoning ? 'Opnieuw controleren' : 'Controleren'}
        </button>
      </form>

      <p className="melding-ok" role="status" aria-live="polite">
        {melding ?? ''}
      </p>

      {voorvertoning ? (
        <section className="kader" aria-labelledby="voorvertoning-titel">
          <h3 id="voorvertoning-titel">Voorvertoning (concept)</h3>
          <VoorvertoningWeergave
            v={voorvertoning}
            onAlias={() => {
              setMelding('Alias toegevoegd. Klik op "Opnieuw controleren".');
            }}
          />
          <div className="knoppen">
            <button
              type="button"
              disabled={afronden.isPending}
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
            </button>
            <button
              type="button"
              className="secundair"
              disabled={afronden.isPending}
              onClick={() => {
                afronden.mutate('verwerpen');
              }}
            >
              Verwerpen
            </button>
          </div>
        </section>
      ) : null}

      <Historie />
    </section>
  );
}
