import { DOELBINDING_TEKST } from '../components/Doelbinding';

/** Infopagina over doel en gegevens (SPEC §1: doelbinding zichtbaar in de app). */
export function OverDeApp() {
  return (
    <section aria-labelledby="over-titel">
      <h2 id="over-titel">Over deze app</h2>
      <p>
        <strong>{DOELBINDING_TEKST}</strong>
      </p>
      <h3>Waarvoor</h3>
      <p>
        De app laat zien wie nog ruimte heeft voor een nieuwe school, een project of een incidentele
        activiteit, en hoe de geplande uren zich verhouden tot wat in MATT is geboekt.
      </p>
      <h3>Welke gegevens</h3>
      <ul className="lijst">
        <li>Naam en zakelijk e-mailadres van medewerkers.</li>
        <li>
          Contracturen, vakantie-uren per kalenderjaar en periodes van minder beschikbaarheid.
        </li>
        <li>
          Bij minder beschikbaarheid alleen het percentage. Er wordt <strong>nooit</strong> een
          reden vastgelegd, zoals ziekte of soort verlof.
        </li>
        <li>Toewijzingen aan scholen, activiteiten en projecten.</li>
        <li>
          Boekingen uit MATT (datum, project, artikel, uren). De omschrijving van een boeking ziet
          alleen de medewerker zelf; een coordinator of beheerder kan die alleen opvragen als dat
          nodig is, en dat wordt vastgelegd.
        </li>
      </ul>
      <h3>Wie ziet wat</h3>
      <p>
        Je ziet altijd je eigen gegevens. Coordinatoren, managers en beheerders zien de belasting
        van het hele team om het werk eerlijk te verdelen. Elke wijziging wordt vastgelegd in een
        logboek.
      </p>
    </section>
  );
}
