import { describe, expect, it } from 'vitest';
import { leesOmgeving } from './omgeving';

describe('leesOmgeving', () => {
  it('accepteert een geldige URL en sleutel', () => {
    const o = leesOmgeving({
      VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
      VITE_SUPABASE_ANON_KEY: 'een-publieke-sleutel-van-voldoende-lengte',
    });
    expect(o.VITE_SUPABASE_URL).toBe('http://127.0.0.1:54321');
  });

  it('weigert ontbrekende of ongeldige waarden', () => {
    expect(() => leesOmgeving({})).toThrow(/SETUP/);
    expect(() =>
      leesOmgeving({ VITE_SUPABASE_URL: 'geen url', VITE_SUPABASE_ANON_KEY: 'x'.repeat(30) }),
    ).toThrow();
  });
});
