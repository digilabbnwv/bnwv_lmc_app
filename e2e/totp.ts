// TOTP-codes (RFC 6238, SHA-1, 6 cijfers, 30 s) voor de end-to-end-test.

function base32NaarBytes(invoer: string): Uint8Array<ArrayBuffer> {
  const alfabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const schoon = invoer.toUpperCase().replace(/=+$/, '').replace(/\s/g, '');
  let bits = 0;
  let waarde = 0;
  const uit: number[] = [];
  for (const teken of schoon) {
    const index = alfabet.indexOf(teken);
    if (index < 0) throw new Error(`Ongeldig base32-teken: ${teken}`);
    waarde = (waarde << 5) | index;
    bits += 5;
    if (bits >= 8) {
      uit.push((waarde >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return new Uint8Array(uit);
}

export async function totp(geheim: string, tijdstip = Date.now()): Promise<string> {
  const teller = Math.floor(tijdstip / 1000 / 30);
  const bericht = new Uint8Array(8);
  new DataView(bericht.buffer).setBigUint64(0, BigInt(teller));
  const sleutel = await crypto.subtle.importKey(
    'raw',
    base32NaarBytes(geheim),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  );
  const hmac = new Uint8Array(await crypto.subtle.sign('HMAC', sleutel, bericht));
  const offset = (hmac[hmac.length - 1] as number) & 0x0f;
  const getal = (((hmac[offset] as number) & 0x7f) << 24) |
    ((hmac[offset + 1] as number) << 16) |
    ((hmac[offset + 2] as number) << 8) |
    (hmac[offset + 3] as number);
  return String(getal % 1_000_000).padStart(6, '0');
}
