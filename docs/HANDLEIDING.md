# Handleiding LMC-capaciteit

> Dit overzicht is bedoeld voor capaciteitsplanning en een eerlijke werkverdeling. Het is geen middel om prestaties te beoordelen.

De app laat zien wie ruimte heeft voor een nieuwe school, een project of een incidentele activiteit, en hoe de planning zich verhoudt tot wat in MATT is geboekt. Werkt op laptop en tablet, in een actuele browser met JavaScript aan.

## 1. Eerste keer inloggen

1. Je krijgt van een manager of beheerder je e-mailadres en een **tijdelijk wachtwoord**.
2. Log in. De app vraagt je een **eigen wachtwoord** te kiezen: minimaal 12 tekens. Een zin werkt goed, bijvoorbeeld _drie boeken op de plank_.
3. Koppel een **authenticator-app** op je telefoon, zoals Microsoft Authenticator of Google Authenticator. Scan de QR-code, of typ de sleutel over, en vul de code van 6 cijfers in.
4. Klaar. Voortaan log je in met je e-mailadres, je wachtwoord en een code uit de app.

**Tweede toestel:** onder **Beveiliging** kun je een tweede telefoon of tablet koppelen. Dat is handig als je je telefoon kwijtraakt.

**Telefoon kwijt of wachtwoord vergeten?** Er is geen herstel per e-mail. Vraag een manager of beheerder om je account te **resetten**. Je krijgt dan een nieuw tijdelijk wachtwoord en koppelt opnieuw een authenticator-app.

Na 30 minuten zonder activiteit word je automatisch uitgelogd.

## 2. Mijn belasting

Voor het gekozen schooljaar zie je:

| Getal                 | Betekenis                                                                                                |
| --------------------- | -------------------------------------------------------------------------------------------------------- |
| **Inzetbaar**         | Je contracturen op werkdagen, min feestdagen, minder beschikbaarheid, vakantie-uren en overhead          |
| **Gepland**           | Alle uren uit je toewijzingen: scholen (staffel × opslag), activiteiten (normuren × aantal) en projecten |
| **Gerealiseerd**      | Uren die in MATT zijn geboekt (definitieve imports)                                                      |
| **Resterende ruimte** | Inzetbaar min gepland                                                                                    |

De **belastingsgraad** is gepland gedeeld door inzetbaar, met een neutrale zone:

| Zone                | Betekenis                       |
| ------------------- | ------------------------------- |
| Ruimte              | onder 85%                       |
| Vol                 | 85% tot en met 100%             |
| Boven capaciteit    | boven 100%                      |
| Geen inzetbare uren | in dit schooljaar geen contract |

De grenzen zijn instellingen en kunnen per datum veranderen.

Daaronder staan je toewijzingen, en per maand je inzetbare en geplande uren.

## 3. Gepland en gerealiseerd

Hier vergelijk je de planning met MATT:

- **Per categorie:** uitvoering, voorbereiding en afronding, en relatiebeheer. Relatiebeheer wordt niet gepland, alleen geboekt.
- **Per werkpakket:** de school, activiteit of het project waarop de uren zijn gepland en geboekt.
- **Niet gekoppeld:** uren op MATT-projecten die nog niet aan een werkpakket hangen.
- **Tot vandaag:** het deel van de planning tot vandaag, naast wat tot vandaag is geboekt.

Een verschil is geen oordeel. Planning en werkelijkheid lopen vaak verschillend door het jaar heen.

## 4. Teamoverzicht (coordinator, manager, beheerder)

Een tabel met per medewerker de contracturen, inzetbaar, gepland, resterende ruimte en de belasting. Standaard staat bovenaan wie de meeste ruimte heeft. Klik op een kolomkop om anders te sorteren, en op een naam om gepland en gerealiseerd van die medewerker te zien. Alleen medewerkers met een contract in het schooljaar staan erin.

## 5. Beheer (coordinator, manager, beheerder)

Onder **Beheer** staan:

- **Configuratie:** schooljaren, schoolvakanties, feestdagen, staffel, opslagfactoren, instellingen (overhead en grenzen, met ingangsdatum) en MATT-artikelcodes.
  - **Nieuw schooljaar:** maak het schooljaar aan en gebruik **Configuratie overnemen**. Dat kopieert de staffel, de opslagfactoren (opnieuw "nog te bevestigen") en de schoolvakanties. Controleer daarna de vakantiedatums. Toewijzingen worden niet gekopieerd.
- **Medewerkers:** gegevens, contracten, vakantie-uren (per kalenderjaar, van HR), beschikbaarheid en aliassen.
  - **Beschikbaarheid:** leg alleen het percentage vast, **nooit een reden**.
  - **Medewerker vertrekt:** zet de medewerker op _niet actief_. De toegang tot de app vervalt dan direct.
- **Werk:** scholen, leerlingen per schooljaar, activiteittypes, activiteiten, projecten en MATT-projecten. De beheerder kan het werk alleen inzien.
- **Toewijzingen:** per schooljaar. Het formulier past zich aan:

  | Soort werkpakket | Wat je invult                                                      |
  | ---------------- | ------------------------------------------------------------------ |
  | School           | staffel, met een aandeel bij meerdere LMC'ers (bijvoorbeeld 60/40) |
  | Activiteit       | aantal keer                                                        |
  | Project          | uren per categorie, verdeeld over een looptijd                     |

  Een opmerking verschijnt als de aandelen van een school niet samen 100% zijn.

## 6. MATT-import (coordinator, manager, beheerder)

1. Exporteer in MATT het rapport _Project uren per projectmanager status_ als **XML**.
2. Ga naar **MATT-import**, kies het bestand en vul de **periode** in waarover de export gaat.
3. Klik op **Controleren**. De app controleert het bestand: grootte, opbouw, subtotalen en periode. Je krijgt een voorvertoning met:
   - aantallen per medewerker;
   - **namen zonder alias**: die boekingen worden niet opgeslagen. Koppel de naam met **Alias toevoegen** aan een medewerker en klik op **Opnieuw controleren**;
   - **MATT-projecten zonder werkpakket**: de boekingen worden wel opgeslagen. Koppel ze bij Beheer → MATT-projecten;
   - **artikelcodes zonder categorie**: vul ze aan bij Beheer → MATT-artikelcodes.
4. Klik op **Definitief maken**. Bestaande boekingen van dezelfde medewerkers in die periode worden vervangen. Twee keer hetzelfde bestand importeren geeft dus geen dubbele uren.
5. Een definitieve import kun je **terugdraaien**. De boekingen worden dan verwijderd. Wat die import eerder had vervangen, komt niet terug: importeer die periode zo nodig opnieuw.

Het bestand zelf wordt niet bewaard.

## 7. Accounts (manager, beheerder)

- **Account aanmaken:** kies een medewerker zonder account en vink de rollen aan. Je krijgt één keer een tijdelijk wachtwoord te zien; geef het persoonlijk door. Alleen een beheerder kan de rol beheerder toekennen.
- **Account resetten:** verwijdert alle gekoppelde toestellen en geeft een nieuw tijdelijk wachtwoord. Je eigen account kun je niet resetten; vraag dat aan een collega-manager of -beheerder.

## 8. Privacy

- Je ziet altijd alleen je eigen gegevens. Coordinatoren, managers en beheerders zien de belasting van het team.
- De omschrijvingen van je MATT-boekingen ziet alleen jij. Een coordinator of beheerder kan ze opvragen als dat nodig is, en dat wordt vastgelegd.
- Elke wijziging komt in een logboek.
- Zie ook de pagina **Over deze app**.
