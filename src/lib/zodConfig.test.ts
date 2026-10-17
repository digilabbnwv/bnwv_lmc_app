import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { zodZonderEval } from './zodConfig';

describe('zod zonder eval (CSP)', () => {
  it('staat in jitless-modus', () => {
    expect(zodZonderEval).toBe(true);
    expect(z.config().jitless).toBe(true);
  });

  it('valideert nog steeds, zonder new Function', () => {
    const origineel = globalThis.Function;
    let gebruikt = false;
    globalThis.Function = new Proxy(origineel, {
      construct(doel, args: unknown[]) {
        gebruikt = true;
        return Reflect.construct(doel, args) as object;
      },
    });
    try {
      const schema = z.object({ naam: z.string().min(1), uren: z.number() });
      expect(schema.safeParse({ naam: 'x', uren: 1 }).success).toBe(true);
      expect(schema.safeParse({ naam: '', uren: 'a' }).success).toBe(false);
    } finally {
      globalThis.Function = origineel;
    }
    expect(gebruikt).toBe(false);
  });
});
