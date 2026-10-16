// Bouwt de Content Security Policy voor de meta-tag in index.html.
// GitHub Pages kan geen headers zetten, daarom staat de CSP in de HTML (zie CLAUDE.md).

/**
 * Geeft de origin van de Supabase-URL terug, of gooit een fout als de URL
 * ontbreekt of ongeldig is. Alleen http(s) zonder pad, query of fragment.
 */
export function supabaseOrigin(url: string | undefined): string {
  if (!url) {
    throw new Error('VITE_SUPABASE_URL ontbreekt; nodig voor connect-src in de CSP.');
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`VITE_SUPABASE_URL is geen geldige URL: ${url}`);
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('VITE_SUPABASE_URL moet met http:// of https:// beginnen.');
  }
  if (parsed.pathname !== '/' || parsed.search || parsed.hash || parsed.username) {
    throw new Error('VITE_SUPABASE_URL mag alleen een origin zijn (geen pad of query).');
  }
  return parsed.origin;
}

export function bouwCsp(supabaseUrl: string | undefined): string {
  const origin = supabaseOrigin(supabaseUrl);
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' data:",
    "font-src 'self'",
    `connect-src ${origin}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-src 'none'",
  ].join('; ');
}
