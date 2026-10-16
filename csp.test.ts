import { describe, expect, it } from 'vitest';
import { bouwCsp, supabaseOrigin } from './csp.ts';

describe('bouwCsp', () => {
  it('beperkt connect-src tot de Supabase-origin', () => {
    const csp = bouwCsp('https://abcdefgh.supabase.co');
    expect(csp).toContain('connect-src https://abcdefgh.supabase.co;');
    expect(csp).toContain("default-src 'self'");
  });

  it('staat geen unsafe-inline of unsafe-eval toe', () => {
    const csp = bouwCsp('http://127.0.0.1:54321');
    expect(csp).not.toContain('unsafe-inline');
    expect(csp).not.toContain('unsafe-eval');
  });

  it('weigert een ontbrekende of onveilige URL', () => {
    expect(() => supabaseOrigin(undefined)).toThrow();
    expect(() => supabaseOrigin('javascript:alert(1)')).toThrow();
    expect(() => supabaseOrigin('https://x.supabase.co/pad?a=1')).toThrow();
    expect(() => supabaseOrigin('https://x.supabase.co" onload="x')).toThrow();
  });
});
