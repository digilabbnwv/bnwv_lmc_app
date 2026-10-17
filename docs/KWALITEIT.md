# Kwaliteitsronde interface (UI-5)

Stand: 17 oktober 2026, na UI-1 t/m UI-4. Alles getest met **fictieve gegevens** in de demomodus (zie onderaan). Herhaal deze ronde na grote wijzigingen in de interface.

## Breedtes en zoom (WCAG 1.4.4, 1.4.10)

Gemeten in Chromium met een geëmuleerde breedte. Per pagina gecontroleerd: valt er iets buiten het scherm (buiten tabelvakken), en scrolt de pagina horizontaal?

| Pagina                   | 320 px | 640 px (= 1280 op 200%) | 768 px | 1024 px | 1280 px |
| ------------------------ | :----: | :---------------------: | :----: | :-----: | :-----: |
| Teamoverzicht            |   ✓    |            ✓            |   ✓    |    ✓    |    ✓    |
| Mijn belasting           |   ✓¹   |            ✓            |   ✓    |    ✓    |    ✓    |
| Gepland en gerealiseerd  |   ✓    |           ✓²            |   ✓    |    ✓    |    ✓    |
| Beheer (overzicht)       |   ✓¹   |            ✓            |   ✓    |    ✓    |    ✓    |
| Beheer › Scholen         |   ✓    |            ✓            |   ✓    |    ✓    |    ✓    |
| Beheer › Toewijzingen    |   ✓    |           ✓²            |   ✓    |    ✓    |    ✓    |
| Beheer › Medewerkers     |   ✓    |            ✓            |   ✓    |    ✓    |    ✓    |
| MATT-import              |   ✓¹   |           ✓²            |   ✓    |    ✓    |    ✓    |
| Accounts                 |   ✓    |           ✓²            |   ✓    |    ✓    |    ✓    |
| Beveiliging, Over de app |   ✓    |            ✓            |   ✓    |    ✓    |    ✓    |

1. Opgelost in UI-5: de kaarten in het beheeroverzicht waren minstens 20rem breed; het bestandsveld en de fieldset bij de import waren breder dan het scherm (grid-kolommen en `fieldset` hebben standaard `min-width: min-content`); de zonebalk met tekst en de legenda konden niet afbreken.
2. Een brede tabel scrolt binnen zijn eigen vak. Dat mag voor datatabellen (uitzondering in 1.4.10). Tabellen zonder knoppen of links zitten in een `TabelVak`: een benoemde regio die focus kan krijgen, zodat je met de pijltjes kunt scrollen (2.1.1).

Op een tablet (vanaf 768 px breed en kleiner) staat het menu achter **Menu**. Teamoverzicht toont onder 48rem een kaart per medewerker. Zijpaneel en dialogen passen op elke breedte; het zijpaneel is onder 48rem schermbreed.

## Contrast (WCAG 1.4.3, 1.4.11)

- `contrast.test.ts` controleert alle kleurparen van de tokens, licht en donker: tekst minstens 4,5:1, randen, focusring, zonebalk, arcering en grafiek minstens 3:1.
- In de browser is **axe-core met kleurcontrast** over alle pagina's uitgevoerd, licht én donker, en met het zijpaneel en de wachtwoordstap open: **geen overtredingen**.
- **Hoogcontrastmodus** (Windows-contrastthema's, `forced-colors`): `src/stijl/hoogcontrast.css` zet zonebalk, arcering, grafiek, stappen en het actieve menu-item in systeemkleuren. Een test controleert dat die regels er zijn.

## Toetsenbord (WCAG 2.1.1, 2.4.3, 2.4.7)

Doorlopen met alleen Tab, Shift+Tab, Enter, spatie, Escape en de pijltjes:

- De eerste Tab is **Naar de inhoud**, daarna het menu en daarna de inhoud, in leesvolgorde. Verborgen onderdelen (zoals het menuknopje op een breed scherm en de teamkaarten) worden overgeslagen.
- Op elk focusbaar element is een focusring van 3 px zichtbaar.
- Een paneel of dialoog houdt de focus vast en sluit met Escape. Daarna gaat de focus terug naar de knop waarmee je hem opende; na verwijderen naar de titel van het scherm.
- In tabbladen werken links, rechts, Home en End. Na een stap in de import gaat de focus naar de kop van die stap.

## Teksten

- De je-vorm, B1-niveau en een neutrale toon, zoals de huisstijlgids voorschrijft (§1.4). Overal staat "coördinator" met trema.
- Een **woordenlijst** staat in de handleiding (§12).
- De doelbindingstest weigert beoordelende woorden in de code; dezelfde controle geldt nu ook voor de handleiding.

## Na de uitrol, door de eigenaar

- [ ] Rondgang in de echte app met een fictief manageraccount: aanmaken, resetten, importeren (synthetische fixture) en het rekenvoorbeeld bij een toewijzing.
- [ ] Controleren of JavaScript aan staat op de kiosk-iPads (JAMF MDM).
- [ ] Logo opnemen zodra de officiële SVG is aangeleverd.

## Demomodus en schermafbeeldingen (alleen development)

Start de dev-server met een plaatshouder-URL (geen echt project nodig) en open:

- `http://localhost:5173/#/demo` om een rol te kiezen, of direct
- `http://localhost:5173/#/demo/<rol>/<pagina>`, bijvoorbeeld `#/demo/manager/team`.

De demomodus gebruikt een nagebootste Supabase-client met fictieve gegevens (`src/demo/`); schrijven doet niets. Hij bestaat alleen in development; CI controleert dat hij niet in de build staat.

Voor de handleiding: `?schermafbeelding` verbergt de demobalk, en `?stappen=` voert na het laden een paar vaste handelingen uit, gescheiden door `|`: `klik:<tekst of aria-label>`, `vink:<label>` en `bestand`. De afbeeldingen in `docs/afbeeldingen/` zijn gemaakt met Edge headless in lichte modus, bijvoorbeeld:

```bash
msedge --headless=new --hide-scrollbars --blink-settings=preferredColorScheme=1 --window-size=1280,960 --virtual-time-budget=20000 --screenshot=docs/afbeeldingen/import-stap2.png "http://localhost:5173/?schermafbeelding&stappen=bestand|klik:Vorige%20maand|klik:Controleren#/demo/coordinator/import"
```

Let op: Edge headless heeft een minimale vensterbreedte van ongeveer 500 px. Controleer smallere breedtes in een browser met een geëmuleerde breedte.
