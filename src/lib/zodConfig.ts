// Zod zonder eval. Onze CSP staat geen eval toe (SPEC §2); zonder deze instelling
// probeert zod `new Function` en meldt de browser een CSP-schending, ook al vangt zod
// de fout zelf op. Moet als eerste worden geïmporteerd, vóór er gevalideerd wordt.
import { z } from 'zod';

z.config({ jitless: true });

export const zodZonderEval = z.config().jitless === true;
