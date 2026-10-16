// Vertaalt fouten van de database (PostgREST) naar begrijpelijke Nederlandse meldingen.
// De database beslist; dit maakt de beslissing alleen leesbaar.

interface DatabaseFout {
  code?: unknown;
  message?: unknown;
  details?: unknown;
}

function tekst(waarde: unknown): string {
  return typeof waarde === 'string' ? waarde : '';
}

export function vertaalFout(fout: unknown): string {
  if (fout instanceof Error && !('code' in fout)) return fout.message;
  const f = (fout ?? {}) as DatabaseFout;
  const code = tekst(f.code);
  const melding = tekst(f.message);

  switch (code) {
    case '23505':
      return 'Dit bestaat al. Controleer of je een dubbele invoer maakt.';
    case '23P01':
      return 'Deze periode overlapt met een bestaande periode.';
    case '23503':
    case '23001':
      return 'Dit wordt nog gebruikt en kan niet worden verwijderd of gewijzigd. Zet het eventueel op niet actief.';
    case '23502':
      return 'Niet alle verplichte velden zijn ingevuld.';
    case '23514':
      // Eigen meldingen uit triggers zijn al Nederlands; check-constraints niet.
      return /[a-z]+_check|violates check constraint/i.test(melding)
        ? 'Een of meer waarden voldoen niet aan de regels. Controleer de invoer.'
        : melding;
    case '42501':
      return 'Je hebt hiervoor geen rechten.';
    case 'P0002':
      return melding || 'Niet gevonden.';
    case '22023':
      return melding || 'Ongeldige invoer.';
    default:
      return 'Er ging iets mis bij het opslaan. Probeer het opnieuw.';
  }
}
