// The push kinds of the queues (#192): a building, a research and an order of
// the Schiffsschmiede that is done. `order` is the place in the options.
export const pushTopics = [
  { key: 'buildings', order: 10, label: 'Gebäude fertig' },
  { key: 'research', order: 20, label: 'Forschung abgeschlossen' },
  {
    key: 'shipyard',
    order: 30,
    label: 'Auftrag der Schiffsschmiede abgeschlossen',
  },
] as const;
