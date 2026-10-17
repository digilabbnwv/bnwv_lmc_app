// Sterke tijdelijke wachtwoorden (SPEC §7).

const HOOFDLETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const KLEINE_LETTERS = 'abcdefghijkmnopqrstuvwxyz';
const CIJFERS = '23456789';
const LEESTEKENS = '-_+=!?#%';

/** Alfabet zonder verwarrende tekens (geen 0/O, 1/l/I). 65 tekens. */
export const ALFABET = HOOFDLETTERS + KLEINE_LETTERS + CIJFERS + LEESTEKENS;
export const LENGTE = 20;
export const TEKENKLASSEN = [HOOFDLETTERS, KLEINE_LETTERS, CIJFERS, LEESTEKENS] as const;

function willekeurig(lengte: number): string {
  const grens = 256 - (256 % ALFABET.length);
  const tekens: string[] = [];
  const buffer = new Uint8Array(lengte * 2);
  while (tekens.length < lengte) {
    crypto.getRandomValues(buffer);
    for (const byte of buffer) {
      if (byte < grens && tekens.length < lengte) {
        tekens.push(ALFABET[byte % ALFABET.length] as string);
      }
    }
  }
  return tekens.join('');
}

/**
 * Genereert een tijdelijk wachtwoord met crypto.getRandomValues. Rejection sampling
 * voorkomt modulo-bias. 20 tekens uit 65 ≈ 120 bits entropie.
 * Het wachtwoord bevat altijd minstens één teken uit elke klasse, zodat het ook wordt
 * geaccepteerd als in Supabase (per ongeluk) samenstellingseisen aan staan. De eis uit
 * SPEC §7 ("geen samenstellingsregels") gaat over wat de gebruiker zelf kiest.
 */
export function genereerWachtwoord(lengte = LENGTE): string {
  for (;;) {
    const w = willekeurig(lengte);
    if (TEKENKLASSEN.every((klasse) => [...w].some((t) => klasse.includes(t)))) return w;
  }
}
