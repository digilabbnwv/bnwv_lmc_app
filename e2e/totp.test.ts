import { assertEquals } from '@std/assert';
import { totp } from './totp.ts';

// Testvector uit RFC 6238 (SHA-1), geheim "12345678901234567890" in base32.
const GEHEIM = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

Deno.test('totp volgt de RFC 6238-testvectoren', async () => {
  assertEquals(await totp(GEHEIM, 59_000), '287082');
  assertEquals(await totp(GEHEIM, 1_111_111_109_000), '081804');
  assertEquals(await totp(GEHEIM, 1_234_567_890_000), '005924');
  assertEquals(await totp(GEHEIM, 2_000_000_000_000), '279037');
});
