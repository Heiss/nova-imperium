// The push kinds of the fleets (#192): the own fleets, an attack on and
// espionage at the own planets, and a delivery of another player.
export const pushTopics = [
  {
    key: 'fleet',
    order: 40,
    label: 'Eigene Flotten: Ankunft, Bericht und Rückkehr',
  },
  { key: 'attacked', order: 50, label: 'Sturmangriff auf deine Planeten' },
  { key: 'spied', order: 60, label: 'Auspex-Aktivität bei deinen Planeten' },
  { key: 'delivery', order: 70, label: 'Lieferung eines anderen Spielers' },
] as const;
