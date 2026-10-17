// Componentengalerij (alleen in development, #/voorbeelden). Uitsluitend fictieve gegevens.
// Bedoeld om componenten en tokens te bekijken en te screenshotten zonder in te loggen.
import { useState } from 'react';
import { z } from 'zod';
import { BeheerScherm } from '../beheer/BeheerScherm';
import { v } from '../beheer/schema';
import type { BeheerDefinitie } from '../beheer/types';
import { rechtenVoor } from '../auth/rechten';
import { useBevestig } from '../components/ui/Bevestiging';
import { Dialoog } from '../components/ui/Dialoog';
import { Badge, Kaart, LegeStaat } from '../components/ui/Kaart';
import { Knop, PictogramKnop } from '../components/ui/Knop';
import { Laden } from '../components/ui/Laden';
import { Melding } from '../components/ui/Melding';
import { useToast } from '../components/ui/Toasts';
import { Indeling } from '../indeling/Indeling';
import { ZoneWeergave } from '../weergaven/Zone';

const KLEUREN = [
  ['--merk-oranje', 'Merk: oranje (alleen accent)'],
  ['--merk-antraciet', 'Merk: antraciet'],
  ['--merk-beige', 'Merk: beige'],
  ['--achtergrond', 'Achtergrond'],
  ['--oppervlak-zacht', 'Oppervlak zacht'],
  ['--markering', 'Markering'],
  ['--tekst', 'Tekst'],
  ['--gedempt', 'Gedempte tekst'],
  ['--rand-sterk', 'Rand (velden)'],
] as const;

const TEAM = [
  { naam: 'Lotte Visser', uren: 812.4, graad: 0.72, zone: 'ruimte' },
  { naam: 'Daan de Boer', uren: 1104.0, graad: 0.98, zone: 'vol' },
  { naam: 'Fatima el Idrissi', uren: 1210.5, graad: 1.12, zone: 'boven_capaciteit' },
] as const;

export default function Galerij() {
  return (
    <Indeling
      rechten={rechtenVoor(['manager'])}
      email="voorbeeld@voorbeeld.test"
      uitloggen={() => undefined}
      titel="Componentengalerij"
    >
      <div className="galerij">
        <h2>Componentengalerij</h2>
        <p className="gedempt">Alleen zichtbaar in development. Alle gegevens zijn fictief.</p>
        <Kleuren />
        <Typografie />
        <Knoppen />
        <Meldingen />
        <Blokken />
        <Tabel />
        <Overlays />
        <Formulier />
        <Beheer />
      </div>
    </Indeling>
  );
}

function Kleuren() {
  return (
    <section aria-labelledby="g-kleuren">
      <h3 id="g-kleuren">Kleuren</h3>
      <div className="galerij-kleuren">
        {KLEUREN.map(([token, naam]) => (
          <div key={token} className="galerij-staal">
            <span className="galerij-staal-kleur" style={{ background: `var(${token})` }} />
            <span>{naam}</span>
            <code>{token}</code>
          </div>
        ))}
      </div>
    </section>
  );
}

function Typografie() {
  return (
    <section aria-labelledby="g-typo">
      <h3 id="g-typo">Typografie</h3>
      <p style={{ fontSize: 'var(--kop-1)', fontWeight: 800, lineHeight: 1.2 }}>
        Kop 1 · Plus Jakarta Sans ExtraBold
      </p>
      <p style={{ fontSize: 'var(--kop-2)', fontWeight: 800, lineHeight: 1.2 }}>
        Kop 2 · Plus Jakarta Sans ExtraBold
      </p>
      <p style={{ fontSize: 'var(--kop-3)', fontWeight: 700, lineHeight: 1.2 }}>
        Kop 3 · Plus Jakarta Sans Bold
      </p>
      <p>
        Broodtekst in Plus Jakarta Sans Regular. Korte, heldere zinnen in de je-vorm. Cijfers staan
        in tabellen rechts uitgelijnd: <span className="numeriek">1.234,5</span> uur.
      </p>
      <p className="gedempt">Gedempte tekst voor toelichting.</p>
    </section>
  );
}

function Knoppen() {
  return (
    <section aria-labelledby="g-knoppen">
      <h3 id="g-knoppen">Knoppen</h3>
      <div className="galerij-rij">
        <Knop>Opslaan</Knop>
        <Knop variant="secundair">Annuleren</Knop>
        <Knop variant="stil">Meer opties</Knop>
        <Knop bezig>Bezig met opslaan</Knop>
        <Knop disabled>Niet beschikbaar</Knop>
        <PictogramKnop pictogram="sluiten" label="Sluiten" />
      </div>
    </section>
  );
}

function Meldingen() {
  return (
    <section aria-labelledby="g-meldingen">
      <h3 id="g-meldingen">Meldingen</h3>
      <Melding titel="Alleen inzien">
        Je kunt dit onderdeel inzien. Wijzigen kan een coördinator of manager.
      </Melding>
      <Melding soort="let-op">Er zijn 3 regels met een onbekende artikelcode.</Melding>
      <Melding soort="gelukt">De import is definitief gemaakt.</Melding>
      <Melding soort="fout" titel="Opslaan is niet gelukt">
        Controleer je verbinding en probeer het opnieuw.
      </Melding>
    </section>
  );
}

function Blokken() {
  return (
    <section aria-labelledby="g-blokken">
      <h3 id="g-blokken">Kaarten, labels, lege staat en laden</h3>
      <Kaart titel="Inzetbaar dit schooljaar" niveau={4}>
        <p className="kerngetal-waarde">1.104,0 uur</p>
        <p className="gedempt">Contracturen min vakanties en vaste taken.</p>
      </Kaart>
      <div className="galerij-rij">
        <Badge>lmc</Badge>
        <Badge>coördinator</Badge>
        <Badge nadruk>manager</Badge>
      </div>
      <LegeStaat titel="Nog geen scholen" actie={<Knop>School toevoegen</Knop>}>
        Voeg een school toe om activiteiten en projecten te kunnen koppelen.
      </LegeStaat>
      <Laden tekst="Teamoverzicht laden…" />
    </section>
  );
}

function Tabel() {
  return (
    <section aria-labelledby="g-tabel">
      <h3 id="g-tabel">Tabel met zones</h3>
      <div className="tabel-schuif">
        <table>
          <caption className="verborgen">Fictief teamoverzicht</caption>
          <thead>
            <tr>
              <th scope="col">Medewerker</th>
              <th scope="col" className="numeriek">
                Gepland (uur)
              </th>
              <th scope="col">Zone</th>
            </tr>
          </thead>
          <tbody>
            {TEAM.map((r) => (
              <tr key={r.naam}>
                <th scope="row">{r.naam}</th>
                <td className="numeriek">{r.uren.toLocaleString('nl-NL')}</td>
                <td>
                  <ZoneWeergave zone={r.zone} graad={r.graad} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Overlays() {
  const [dialoog, setDialoog] = useState(false);
  const [paneel, setPaneel] = useState(false);
  const [antwoord, setAntwoord] = useState<string | null>(null);
  const bevestig = useBevestig();
  const toon = useToast();
  return (
    <section aria-labelledby="g-overlays">
      <h3 id="g-overlays">Dialoog, zijpaneel, bevestiging en toast</h3>
      <div className="galerij-rij">
        <Knop
          variant="secundair"
          onClick={() => {
            setDialoog(true);
          }}
        >
          Dialoog openen
        </Knop>
        <Knop
          variant="secundair"
          onClick={() => {
            setPaneel(true);
          }}
        >
          Zijpaneel openen
        </Knop>
        <Knop
          variant="secundair"
          onClick={() => {
            void bevestig({
              titel: 'School verwijderen?',
              tekst: 'De school "De Regenboog" en de koppelingen met projecten verdwijnen.',
              bevestigTekst: 'Verwijderen',
            }).then((ja) => {
              setAntwoord(ja ? 'Bevestigd' : 'Geannuleerd');
            });
          }}
        >
          Bevestiging vragen
        </Knop>
        <Knop
          variant="secundair"
          onClick={() => {
            toon('Wijzigingen opgeslagen.');
          }}
        >
          Toast tonen
        </Knop>
      </div>
      {antwoord ? <p role="status">Antwoord: {antwoord}</p> : null}
      <Dialoog
        open={dialoog}
        titel="Schooljaar kopiëren"
        opSluiten={() => {
          setDialoog(false);
        }}
        acties={
          <>
            <Knop
              variant="secundair"
              onClick={() => {
                setDialoog(false);
              }}
            >
              Annuleren
            </Knop>
            <Knop
              onClick={() => {
                setDialoog(false);
              }}
            >
              Kopiëren
            </Knop>
          </>
        }
      >
        <p>De configuratie van 2026-2027 wordt gekopieerd naar 2027-2028.</p>
      </Dialoog>
      <Dialoog
        soort="zijpaneel"
        open={paneel}
        titel="School bewerken"
        opSluiten={() => {
          setPaneel(false);
        }}
        acties={
          <>
            <Knop
              variant="secundair"
              onClick={() => {
                setPaneel(false);
              }}
            >
              Annuleren
            </Knop>
            <Knop
              onClick={() => {
                setPaneel(false);
              }}
            >
              Opslaan
            </Knop>
          </>
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
          }}
        >
          <label>
            Naam
            <input data-autofocus defaultValue="De Regenboog" />
          </label>
          <label>
            Plaats
            <input defaultValue="Harderwijk" />
          </label>
        </form>
      </Dialoog>
    </section>
  );
}

function Formulier() {
  return (
    <section aria-labelledby="g-formulier">
      <h3 id="g-formulier">Formulier</h3>
      <form
        onSubmit={(e) => {
          e.preventDefault();
        }}
      >
        <label>
          E-mailadres
          <input type="email" autoComplete="off" defaultValue="lotte.visser@voorbeeld.test" />
        </label>
        <label>
          Rol
          <select defaultValue="lmc">
            <option value="lmc">lmc</option>
            <option value="coordinator">coördinator</option>
          </select>
        </label>
        <label className="veld-vinkje">
          <input type="checkbox" defaultChecked />
          Actief
        </label>
        <div className="knoppen">
          <Knop type="submit">Opslaan</Knop>
          <Knop variant="secundair">Annuleren</Knop>
        </div>
      </form>
    </section>
  );
}

interface School {
  id: string;
  naam: string;
  plaats: string;
  leerlingen: number;
}

const SCHOLEN: School[] = [
  { id: 's1', naam: 'De Regenboog', plaats: 'Harderwijk', leerlingen: 212 },
  { id: 's2', naam: 'Het Kompas', plaats: 'Ermelo', leerlingen: 168 },
  { id: 's3', naam: 'De Klimboom', plaats: 'Putten', leerlingen: 305 },
];

const schoolSchema = z.object({
  naam: v.tekst(100),
  plaats: v.tekst(100),
  leerlingen: v.getal({ min: 0 }),
});

const schoolDefinitie: BeheerDefinitie<School, z.infer<typeof schoolSchema>> = {
  titel: 'Scholen (voorbeeld)',
  enkelvoud: 'school',
  queryKey: ['galerij', 'scholen'],
  laad: () => Promise.resolve(SCHOLEN),
  sleutel: (r) => r.id,
  rijNaam: (r) => r.naam,
  kolommen: [
    { kop: 'Naam', waarde: (r) => r.naam, sorteer: (r) => r.naam },
    { kop: 'Plaats', waarde: (r) => r.plaats, sorteer: (r) => r.plaats },
    {
      kop: 'Leerlingen',
      waarde: (r) => String(r.leerlingen),
      sorteer: (r) => r.leerlingen,
      numeriek: true,
    },
  ],
  velden: [
    { naam: 'naam', label: 'Naam', type: 'tekst', verplicht: true },
    { naam: 'plaats', label: 'Plaats', type: 'tekst', verplicht: true },
    { naam: 'leerlingen', label: 'Aantal leerlingen', type: 'getal', verplicht: true },
  ],
  schema: schoolSchema,
  leeg: () => ({ naam: '', plaats: '', leerlingen: '' }),
  naarFormulier: (r) => ({ naam: r.naam, plaats: r.plaats, leerlingen: String(r.leerlingen) }),
  // Galerij: er wordt niets opgeslagen.
  opslaan: () => Promise.resolve(),
  verwijder: () => Promise.resolve(),
};

function Beheer() {
  const [bewerken, setBewerken] = useState(true);
  return (
    <section aria-labelledby="g-beheer">
      <h3 id="g-beheer">Beheerscherm</h3>
      <label className="veld-vinkje">
        <input
          type="checkbox"
          checked={bewerken}
          onChange={(e) => {
            setBewerken(e.target.checked);
          }}
        />
        Mag bewerken
      </label>
      <BeheerScherm key={String(bewerken)} definitie={schoolDefinitie} magBewerken={bewerken} />
    </section>
  );
}
