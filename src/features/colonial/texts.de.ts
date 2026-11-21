import type { EntryText } from '../../core/text.ts';

// The name is the one of issue #237 (owner, 2026-11-17, D2: „Kolonialverwaltung“);
// the abbreviation, the short and the long text are [V].
export const texts: EntryText = {
  n: 'Kolonialverwaltung',
  ab: 'KV',
  ds: 'Erhöht die Planetengrenze: jede Stufe erlaubt weitere Planeten.',
  lt: 'Die Kolonialverwaltung ordnet, wie viele Welten ein Herrscher zugleich regieren kann.\n\nSo funktioniert es: Hat der Admin für die Runde eine Planetengrenze gesetzt und die Kolonieforschung aktiviert, erlaubt jede Stufe weitere Planeten über die Grundgrenze hinaus. Der Heimatplanet zählt mit, Monde nicht.',
};
