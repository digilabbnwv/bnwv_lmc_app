// Automatische toegankelijkheidscontrole met axe-core (alleen in tests).
import axe from 'axe-core';

/**
 * Geeft de WCAG-overtredingen in `element` terug als leesbare regels (leeg = geen fouten).
 * Kleurcontrast kan jsdom niet berekenen; dat toetst contrast.test.ts op de tokens.
 */
export async function toegankelijkheidsfouten(element: Element): Promise<string[]> {
  const uitslag = await axe.run(element, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] },
    rules: {
      'color-contrast': { enabled: false },
      // Losse componenten staan in tests niet in een landmark.
      region: { enabled: false },
    },
  });
  return uitslag.violations.map(
    (v) => `${v.id}: ${v.help} → ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
  );
}
