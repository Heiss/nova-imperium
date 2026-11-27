// The event of the launch of an attack on a member in the guild chat (#169
// D4; owner, 2026-11-15): „⚔ Angriff auf [1:27:11] (Vex → Lea), Ankunft
// 20:15“; `text` is the target, `arrival` the time of the arrival as the
// browser shows it.
export const chatEvents = [
  {
    key: 'attack',
    order: 50,
    sentence: ({
      name,
      text,
      attacker,
      arrival,
    }: {
      name: string;
      text: string;
      attacker: string;
      arrival: string;
    }) => `⚔ Angriff auf ${text} (${attacker} → ${name}), Ankunft ${arrival}`,
  },
] as const;
