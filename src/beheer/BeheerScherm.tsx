// Generiek beheerscherm: overzicht (zoeken, sorteren) en een zijpaneel voor toevoegen,
// wijzigen, bekijken en verwijderen. De database beslist over rechten en regels; dit scherm
// valideert vooraf en vertaalt fouten.
import { useEffect, useId, useMemo, useRef, useState, type Ref } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useBevestig } from '../components/ui/Bevestiging';
import { Dialoog } from '../components/ui/Dialoog';
import { LegeStaat } from '../components/ui/Kaart';
import { Knop } from '../components/ui/Knop';
import { Laden } from '../components/ui/Laden';
import { Melding } from '../components/ui/Melding';
import { useToast } from '../components/ui/Toasts';
import { vertaalFout } from '../lib/fouten';
import { foutenPerVeld, type Formulierwaarden } from './schema';
import type { BeheerDefinitie, Veld } from './types';
import { VeldInvoer } from './Velden';

interface Props<R, U> {
  definitie: BeheerDefinitie<R, U>;
  magBewerken: boolean;
}

type Keuze<R> = { soort: 'nieuw' } | { soort: 'bestaand'; rij: R } | null;

export const ALLEEN_INZIEN =
  'Je kunt dit onderdeel inzien. Wijzigen kan een coördinator of manager.';

/** "Scholen" → "scholen", maar "MATT-artikelcodes" blijft staan. */
export function kleineBeginletter(tekst: string): string {
  const tweede = tekst.charAt(1);
  return tweede && tweede === tweede.toLowerCase()
    ? tekst.charAt(0).toLowerCase() + tekst.slice(1)
    : tekst;
}

export function BeheerScherm<R, U>({ definitie, magBewerken }: Props<R, U>) {
  const d = definitie;
  const queryClient = useQueryClient();
  const bevestig = useBevestig();
  const toon = useToast();
  const lijst = useQuery({ queryKey: d.queryKey, queryFn: d.laad });
  const [keuze, setKeuze] = useState<Keuze<R>>(null);
  const [waarden, setWaarden] = useState<Formulierwaarden>({});
  const [begin, setBegin] = useState<Formulierwaarden>({});
  const [fouten, setFouten] = useState<Record<string, string>>({});
  const [foutPoging, setFoutPoging] = useState(0);
  const [zoek, setZoek] = useState('');
  const [sortering, setSortering] = useState<{ kolom: number; oplopend: boolean } | null>(null);
  const titel = useRef<HTMLHeadingElement>(null);
  const zoekveld = useRef<HTMLInputElement>(null);
  const overzicht = useRef<HTMLDivElement>(null);
  const basis = useId();
  const formId = `${basis}-formulier`;
  const titelId = `${basis}-titel`;

  const vernieuw = async () => {
    await queryClient.invalidateQueries({ queryKey: d.queryKey });
    for (const k of d.ookVernieuwen ?? []) await queryClient.invalidateQueries({ queryKey: k });
  };

  const opslaan = useMutation({
    mutationFn: async ({ uit, bestaand }: { uit: U; bestaand: R | null }) => {
      await d.opslaan(uit, bestaand);
    },
    onSuccess: async (_, { bestaand }) => {
      toon(bestaand ? 'Wijziging opgeslagen.' : `Nieuwe ${d.enkelvoud} opgeslagen.`);
      setKeuze(null);
      await vernieuw();
    },
    onError: (e) => {
      setFouten({ _: vertaalFout(e) });
      setFoutPoging((n) => n + 1);
    },
  });

  const verwijderen = useMutation({
    mutationFn: async (rij: R) => {
      if (!d.verwijder) return;
      await d.verwijder(rij);
    },
    onSuccess: async (_, rij) => {
      toon(`${d.rijNaam(rij)} is verwijderd.`);
      setKeuze(null);
      await vernieuw();
      // De knop van de verwijderde rij bestaat niet meer: focus naar de titel.
      titel.current?.focus();
    },
    onError: (e) => {
      setFouten({ _: vertaalFout(e) });
      setFoutPoging((n) => n + 1);
    },
  });

  // Na een mislukte poging: focus op het foutoverzicht (WCAG 3.3.1).
  useEffect(() => {
    if (foutPoging > 0) overzicht.current?.focus();
  }, [foutPoging]);

  function open(nieuweKeuze: Exclude<Keuze<R>, null>) {
    const start = nieuweKeuze.soort === 'bestaand' ? d.naarFormulier(nieuweKeuze.rij) : d.leeg();
    setFouten({});
    setWaarden(start);
    setBegin(start);
    setKeuze(nieuweKeuze);
  }

  const gewijzigd = magBewerken && JSON.stringify(waarden) !== JSON.stringify(begin);

  async function probeerSluiten() {
    if (
      gewijzigd &&
      !(await bevestig({
        titel: 'Wijzigingen weggooien?',
        tekst: 'Je hebt wijzigingen die nog niet zijn opgeslagen.',
        bevestigTekst: 'Weggooien',
      }))
    ) {
      return;
    }
    setKeuze(null);
  }

  async function vraagVerwijderen(rij: R) {
    const ja = await bevestig({
      titel: `${capitaal(d.enkelvoud)} verwijderen?`,
      tekst: `${d.rijNaam(rij)} wordt verwijderd. Dit kun je niet ongedaan maken.`,
      bevestigTekst: 'Verwijderen',
    });
    if (ja) verwijderen.mutate(rij);
  }

  function verstuur() {
    const resultaat = d.schema.safeParse(waarden);
    if (!resultaat.success) {
      setFouten(foutenPerVeld(resultaat.error));
      setFoutPoging((n) => n + 1);
      return;
    }
    setFouten({});
    opslaan.mutate({
      uit: resultaat.data,
      bestaand: keuze?.soort === 'bestaand' ? keuze.rij : null,
    });
  }

  const alle = useMemo(() => lijst.data ?? [], [lijst.data]);
  const term = zoek.trim().toLowerCase();
  const rijen = useMemo(() => {
    let r = alle;
    if (term) {
      r = r.filter((rij) =>
        d.kolommen.some((k) =>
          String(k.sorteer ? k.sorteer(rij) : '')
            .toLowerCase()
            .includes(term),
        ),
      );
    }
    if (sortering) {
      const kolom = d.kolommen[sortering.kolom];
      if (kolom?.sorteer) {
        const s = kolom.sorteer;
        r = [...r].sort((a, b) => {
          const x = s(a);
          const y = s(b);
          const verschil =
            typeof x === 'number' && typeof y === 'number'
              ? x - y
              : String(x).localeCompare(String(y), 'nl');
          return sortering.oplopend ? verschil : -verschil;
        });
      }
    }
    return r;
  }, [alle, term, sortering, d.kolommen]);

  const nieuw = keuze?.soort === 'nieuw';
  const zichtbareVelden = d.velden.filter((v) => !v.zichtbaar || v.zichtbaar(waarden));
  const kanToevoegen = magBewerken && d.kanToevoegen !== false;
  const meervoud = kleineBeginletter(d.titel);
  const toevoegenKnop = kanToevoegen ? (
    <Knop
      onClick={() => {
        open({ soort: 'nieuw' });
      }}
    >
      {`${capitaal(d.enkelvoud)} toevoegen`}
    </Knop>
  ) : null;

  const paneelTitel =
    keuze === null ? '' : keuze.soort === 'nieuw' ? `Nieuwe ${d.enkelvoud}` : d.rijNaam(keuze.rij);

  return (
    <section className="beheer" aria-labelledby={titelId}>
      <h3 id={titelId} ref={titel} tabIndex={-1}>
        {d.titel}
      </h3>
      {d.omschrijving ? <div className="toelichting">{d.omschrijving}</div> : null}
      {magBewerken ? null : <Melding titel="Alleen inzien">{ALLEEN_INZIEN}</Melding>}

      <div className="beheer-balk">
        <label>
          Zoeken
          <input
            ref={zoekveld}
            type="search"
            value={zoek}
            onChange={(e) => {
              setZoek(e.target.value);
            }}
          />
        </label>
        {lijst.data ? (
          <p className="beheer-telling gedempt" aria-live="polite">
            {term
              ? `${String(rijen.length)} van ${String(alle.length)} ${meervoud}`
              : `${String(alle.length)} ${meervoud}`}
          </p>
        ) : null}
        {toevoegenKnop}
      </div>

      {lijst.isPending ? <Laden /> : null}
      {lijst.isError ? <Melding soort="fout">{vertaalFout(lijst.error)}</Melding> : null}
      {lijst.data && alle.length === 0 ? (
        <LegeStaat titel={`Nog geen ${meervoud}`} actie={toevoegenKnop}>
          {kanToevoegen ? `Voeg de eerste ${d.enkelvoud} toe.` : null}
        </LegeStaat>
      ) : null}
      {lijst.data && alle.length > 0 && rijen.length === 0 ? (
        <LegeStaat
          titel={`Geen resultaten voor "${zoek.trim()}"`}
          actie={
            <Knop
              variant="secundair"
              onClick={() => {
                setZoek('');
                zoekveld.current?.focus();
              }}
            >
              Zoekterm wissen
            </Knop>
          }
        />
      ) : null}
      {rijen.length > 0 ? (
        <div className="tabel-schuif tabel-vast">
          <table>
            <caption className="verborgen">{d.titel}</caption>
            <thead>
              <tr>
                {d.kolommen.map((k, i) => (
                  <th
                    key={k.kop}
                    scope="col"
                    className={k.numeriek ? 'numeriek' : undefined}
                    aria-sort={
                      sortering?.kolom === i
                        ? sortering.oplopend
                          ? 'ascending'
                          : 'descending'
                        : undefined
                    }
                  >
                    {k.sorteer ? (
                      <button
                        type="button"
                        className="sorteer"
                        onClick={() => {
                          setSortering((s) =>
                            s?.kolom === i
                              ? { kolom: i, oplopend: !s.oplopend }
                              : { kolom: i, oplopend: true },
                          );
                        }}
                      >
                        {k.kop}
                      </button>
                    ) : (
                      k.kop
                    )}
                  </th>
                ))}
                <th scope="col">
                  <span className="verborgen">Actie</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rijen.map((rij) => (
                <tr key={d.sleutel(rij)}>
                  {d.kolommen.map((k) => (
                    <td key={k.kop} className={k.numeriek ? 'numeriek' : undefined}>
                      {k.waarde(rij)}
                    </td>
                  ))}
                  <td className="actie">
                    <Knop
                      variant="secundair"
                      aria-label={`${magBewerken ? 'Bewerken' : 'Bekijken'}: ${d.rijNaam(rij)}`}
                      onClick={() => {
                        open({ soort: 'bestaand', rij });
                      }}
                    >
                      {magBewerken ? 'Bewerken' : 'Bekijken'}
                    </Knop>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <Dialoog
        soort="zijpaneel"
        open={keuze !== null}
        titel={paneelTitel}
        opSluiten={() => {
          void probeerSluiten();
        }}
        acties={
          <>
            {magBewerken && d.verwijder && keuze?.soort === 'bestaand' ? (
              <Knop
                variant="secundair"
                className="gevaar acties-links"
                bezig={verwijderen.isPending}
                onClick={() => {
                  void vraagVerwijderen(keuze.rij);
                }}
              >
                Verwijderen
              </Knop>
            ) : null}
            <Knop
              variant="secundair"
              onClick={() => {
                void probeerSluiten();
              }}
            >
              {magBewerken ? 'Annuleren' : 'Sluiten'}
            </Knop>
            {magBewerken ? (
              <Knop type="submit" form={formId} bezig={opslaan.isPending}>
                Opslaan
              </Knop>
            ) : null}
          </>
        }
      >
        {magBewerken ? null : <Melding titel="Alleen inzien">{ALLEEN_INZIEN}</Melding>}
        <Foutoverzicht ref={overzicht} fouten={fouten} velden={zichtbareVelden} formId={formId} />
        <form
          id={formId}
          className="paneel-formulier"
          aria-label={paneelTitel}
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (magBewerken) verstuur();
          }}
        >
          {groeperen(zichtbareVelden).map((blok, b) => {
            const velden = blok.velden.map((veld) => (
              <VeldInvoer
                key={veld.naam}
                veld={magBewerken ? veld : { ...veld, alleenLezen: true }}
                waarden={waarden}
                fout={fouten[veld.naam]}
                nieuw={nieuw}
                autofocus={veld === zichtbareVelden[0]}
                onWijzig={(naam, w) => {
                  setWaarden((huidig) => ({ ...huidig, [naam]: w }));
                }}
              />
            ));
            return blok.groep ? (
              <fieldset key={blok.groep} className="veldgroep">
                <legend>{blok.groep}</legend>
                {velden}
              </fieldset>
            ) : (
              <div key={`los-${String(b)}`} className="veldgroep-los">
                {velden}
              </div>
            );
          })}
        </form>
        {d.samenvatting && keuze
          ? d.samenvatting(waarden, keuze.soort === 'bestaand' ? keuze.rij : null)
          : null}
      </Dialoog>
    </section>
  );
}

/** Opeenvolgende velden met dezelfde groep samen; velden zonder groep los. */
export function groeperen(velden: Veld[]): { groep: string | undefined; velden: Veld[] }[] {
  const blokken: { groep: string | undefined; velden: Veld[] }[] = [];
  for (const veld of velden) {
    const laatste = blokken[blokken.length - 1];
    if (laatste && laatste.groep === veld.groep) laatste.velden.push(veld);
    else blokken.push({ groep: veld.groep, velden: [veld] });
  }
  return blokken;
}

function capitaal(tekst: string): string {
  return tekst.charAt(0).toUpperCase() + tekst.slice(1);
}

interface FoutoverzichtProps {
  ref: Ref<HTMLDivElement>;
  fouten: Record<string, string>;
  velden: Veld[];
  formId: string;
}

/** Samenvatting van de fouten bovenaan het paneel, met knoppen die naar het veld springen. */
function Foutoverzicht({ ref, fouten, velden, formId }: FoutoverzichtProps) {
  const perVeld = velden.filter((v) => fouten[v.naam]);
  const algemeen = fouten._;
  return (
    <div ref={ref} tabIndex={-1} className="foutoverzicht">
      {algemeen || perVeld.length > 0 ? (
        <Melding soort="fout" titel={algemeen ? 'Opslaan is niet gelukt' : 'Controleer de velden'}>
          {algemeen ? <p>{algemeen}</p> : null}
          {perVeld.length > 0 ? (
            <ul className="foutoverzicht-lijst">
              {perVeld.map((v) => (
                <li key={v.naam}>
                  <button
                    type="button"
                    className="foutoverzicht-link"
                    onClick={() => {
                      document
                        .getElementById(formId)
                        ?.querySelector<HTMLElement>(`[data-veld="${CSS.escape(v.naam)}"]`)
                        ?.focus();
                    }}
                  >
                    {v.label}: {fouten[v.naam]}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </Melding>
      ) : null}
    </div>
  );
}
