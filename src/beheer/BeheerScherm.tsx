// Generiek beheerscherm: overzicht (zoeken, sorteren) en een formulierpaneel voor
// toevoegen, wijzigen en verwijderen. De database beslist over rechten en regels;
// dit scherm valideert vooraf en vertaalt fouten.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { vertaalFout } from '../lib/fouten';
import { foutenPerVeld, type Formulierwaarden } from './schema';
import type { BeheerDefinitie } from './types';
import { VeldInvoer } from './Velden';

interface Props<R, U> {
  definitie: BeheerDefinitie<R, U>;
  magBewerken: boolean;
}

type Keuze<R> = { soort: 'nieuw' } | { soort: 'bestaand'; rij: R } | null;

export function BeheerScherm<R, U>({ definitie, magBewerken }: Props<R, U>) {
  const d = definitie;
  const queryClient = useQueryClient();
  const lijst = useQuery({ queryKey: d.queryKey, queryFn: d.laad });
  const [keuze, setKeuze] = useState<Keuze<R>>(null);
  const [waarden, setWaarden] = useState<Formulierwaarden>({});
  const [fouten, setFouten] = useState<Record<string, string>>({});
  const [melding, setMelding] = useState<string | null>(null);
  const [zoek, setZoek] = useState('');
  const [sortering, setSortering] = useState<{ kolom: number; oplopend: boolean } | null>(null);
  const eersteVeld = useRef<HTMLElement | null>(null);
  const terugFocus = useRef<string | null>(null);
  const tabel = useRef<HTMLTableElement | null>(null);

  const vernieuw = async () => {
    await queryClient.invalidateQueries({ queryKey: d.queryKey });
    for (const k of d.ookVernieuwen ?? []) await queryClient.invalidateQueries({ queryKey: k });
  };

  const opslaan = useMutation({
    mutationFn: async ({ uit, bestaand }: { uit: U; bestaand: R | null }) => {
      await d.opslaan(uit, bestaand);
    },
    onSuccess: async (_, { bestaand }) => {
      setMelding(`${bestaand ? 'Wijziging' : 'Nieuwe ' + d.enkelvoud} opgeslagen.`);
      sluit();
      await vernieuw();
    },
    onError: (e) => {
      setFouten({ _: vertaalFout(e) });
    },
  });

  const verwijderen = useMutation({
    mutationFn: async (rij: R) => {
      if (!d.verwijder) return;
      await d.verwijder(rij);
    },
    onSuccess: async (_, rij) => {
      setMelding(`${d.rijNaam(rij)} is verwijderd.`);
      terugFocus.current = null;
      sluit();
      await vernieuw();
    },
    onError: (e) => {
      setFouten({ _: vertaalFout(e) });
    },
  });

  function open(nieuweKeuze: Keuze<R>) {
    setMelding(null);
    setFouten({});
    if (nieuweKeuze?.soort === 'bestaand') {
      terugFocus.current = d.sleutel(nieuweKeuze.rij);
      setWaarden(d.naarFormulier(nieuweKeuze.rij));
    } else {
      terugFocus.current = '__nieuw';
      setWaarden(d.leeg());
    }
    setKeuze(nieuweKeuze);
  }

  function sluit() {
    setKeuze(null);
    setFouten({});
  }

  // Focus naar het eerste veld bij openen; terug naar de knop bij sluiten.
  useEffect(() => {
    if (keuze) {
      eersteVeld.current?.focus();
    } else if (terugFocus.current) {
      const knop = tabel.current?.parentElement?.querySelector<HTMLElement>(
        `[data-sleutel="${CSS.escape(terugFocus.current)}"]`,
      );
      knop?.focus();
      terugFocus.current = null;
    }
  }, [keuze]);

  function verstuur() {
    const resultaat = d.schema.safeParse(waarden);
    if (!resultaat.success) {
      setFouten(foutenPerVeld(resultaat.error));
      return;
    }
    setFouten({});
    opslaan.mutate({
      uit: resultaat.data,
      bestaand: keuze?.soort === 'bestaand' ? keuze.rij : null,
    });
  }

  const rijen = useMemo(() => {
    let r = lijst.data ?? [];
    const term = zoek.trim().toLowerCase();
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
  }, [lijst.data, zoek, sortering, d.kolommen]);

  const nieuw = keuze?.soort === 'nieuw';
  const zichtbareVelden = d.velden.filter((v) => !v.zichtbaar || v.zichtbaar(waarden));

  return (
    <section className="beheer" aria-labelledby={`${d.enkelvoud}-titel`}>
      <h3 id={`${d.enkelvoud}-titel`}>{d.titel}</h3>
      {d.omschrijving ? <div className="toelichting">{d.omschrijving}</div> : null}

      <div className="beheer-balk">
        <label>
          Zoeken
          <input
            type="search"
            value={zoek}
            onChange={(e) => {
              setZoek(e.target.value);
            }}
          />
        </label>
        {magBewerken && d.kanToevoegen !== false ? (
          <button
            type="button"
            data-sleutel="__nieuw"
            onClick={() => {
              open({ soort: 'nieuw' });
            }}
          >
            {`${d.enkelvoud.charAt(0).toUpperCase()}${d.enkelvoud.slice(1)} toevoegen`}
          </button>
        ) : null}
      </div>

      <p className="melding-ok" role="status" aria-live="polite">
        {melding ?? ''}
      </p>

      {keuze ? (
        <form
          className="kader beheer-formulier"
          aria-label={nieuw ? `Nieuwe ${d.enkelvoud}` : `${d.enkelvoud} wijzigen`}
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (magBewerken) verstuur();
          }}
        >
          <h4>{keuze.soort === 'nieuw' ? `Nieuwe ${d.enkelvoud}` : d.rijNaam(keuze.rij)}</h4>
          {zichtbareVelden.map((veld, i) => {
            const isEerste = i === 0;
            return (
              <VeldInvoer
                key={veld.naam}
                veld={magBewerken ? veld : { ...veld, alleenLezen: true }}
                waarden={waarden}
                fout={fouten[veld.naam]}
                nieuw={nieuw}
                onWijzig={(naam, w) => {
                  setWaarden((huidig) => ({ ...huidig, [naam]: w }));
                }}
                {...(isEerste
                  ? {
                      eersteVeld: (el: HTMLElement | null) => {
                        eersteVeld.current = el;
                      },
                    }
                  : {})}
              />
            );
          })}
          <p className="melding" role="alert">
            {fouten._ ??
              (Object.keys(fouten).length > 0 ? 'Controleer de gemarkeerde velden.' : '')}
          </p>
          <div className="knoppen">
            {magBewerken ? (
              <button type="submit" disabled={opslaan.isPending}>
                Opslaan
              </button>
            ) : null}
            <button type="button" className="secundair" onClick={sluit}>
              {magBewerken ? 'Annuleren' : 'Sluiten'}
            </button>
            {magBewerken && d.verwijder && keuze.soort === 'bestaand' ? (
              <button
                type="button"
                className="secundair gevaar"
                disabled={verwijderen.isPending}
                onClick={() => {
                  if (window.confirm(`${d.rijNaam(keuze.rij)} verwijderen?`)) {
                    verwijderen.mutate(keuze.rij);
                  }
                }}
              >
                Verwijderen
              </button>
            ) : null}
          </div>
        </form>
      ) : null}

      {lijst.isPending ? <p aria-busy="true">Bezig met laden…</p> : null}
      {lijst.isError ? <p role="alert">{vertaalFout(lijst.error)}</p> : null}
      {lijst.data ? (
        <div className="tabel-schuif">
          <table ref={tabel}>
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
              {rijen.length === 0 ? (
                <tr>
                  <td colSpan={d.kolommen.length + 1}>Geen gegevens.</td>
                </tr>
              ) : (
                rijen.map((rij) => (
                  <tr key={d.sleutel(rij)}>
                    {d.kolommen.map((k) => (
                      <td key={k.kop} className={k.numeriek ? 'numeriek' : undefined}>
                        {k.waarde(rij)}
                      </td>
                    ))}
                    <td>
                      <button
                        type="button"
                        className="secundair"
                        data-sleutel={d.sleutel(rij)}
                        aria-label={`${magBewerken ? 'Bewerken' : 'Bekijken'}: ${d.rijNaam(rij)}`}
                        onClick={() => {
                          open({ soort: 'bestaand', rij });
                        }}
                      >
                        {magBewerken ? 'Bewerken' : 'Bekijken'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
