// HTTP-hulpfuncties voor Edge Functions: CORS, JSON-antwoorden en het bearer-token.

/** Origins die de frontend mogen aanroepen, uit TOEGESTANE_ORIGINS (komma-gescheiden). */
export function toegestaneOrigins(waarde: string | undefined): Set<string> {
  return new Set(
    (waarde ?? '')
      .split(',')
      .map((o) => o.trim())
      .filter((o) => o.length > 0),
  );
}

function corsHeaders(req: Request, origins: Set<string>): Record<string, string> {
  const origin = req.headers.get('Origin');
  if (origin === null || !origins.has(origin)) {
    return { Vary: 'Origin' };
  }
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  };
}

/** JSON-antwoord dat nooit gecachet wordt (het kan een tijdelijk wachtwoord bevatten). */
export function json(
  req: Request,
  origins: Set<string>,
  status: number,
  body: unknown,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(req, origins),
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export function fout(req: Request, origins: Set<string>, status: number, melding: string) {
  return json(req, origins, status, { fout: melding });
}

/** Antwoord op een CORS-preflight, of null als het geen preflight is. */
export function preflight(req: Request, origins: Set<string>): Response | null {
  if (req.method !== 'OPTIONS') return null;
  return new Response(null, { status: 204, headers: corsHeaders(req, origins) });
}

/** Het bearer-token uit de Authorization-header, of null. */
export function bearerToken(req: Request): string | null {
  const header = req.headers.get('Authorization') ?? '';
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  return match?.[1] ?? null;
}

/** Leest de body als JSON; null bij ongeldige of te grote invoer. */
export async function leesJson(req: Request, maxBytes = 10_000): Promise<unknown> {
  const tekst = await req.text();
  if (tekst.length > maxBytes) return null;
  try {
    return JSON.parse(tekst);
  } catch {
    return null;
  }
}
