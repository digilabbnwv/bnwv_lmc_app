// Sterke tijdelijke wachtwoorden (SPEC §7).

/** Alfabet zonder verwarrende tekens (geen 0/O, 1/l/I). 57 tekens. */
export const ALFABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
export const LENGTE = 20;

/**
 * Genereert een tijdelijk wachtwoord met crypto.getRandomValues. Rejection sampling
 * voorkomt modulo-bias. 20 tekens uit 57 ≈ 116 bits entropie.
 */
export function genereerWachtwoord(lengte = LENGTE): string {
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
