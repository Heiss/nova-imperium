// The rule page „Dieses Universum“ (#288): the settings of the universe and
// of the round with the values of this one. It replaces the box „Regeln
// dieses Universums“ of the options; every setting has its row, a guard
// checks it. The values come from `UNIVERSE_SPECS`, the registry of the round
// settings and the state; the words are a draft of Claude for the owner to
// check ([V], #288).
import { expeditionPosition } from '../../expedition.ts';
import { ROUND_SETTINGS, type RoundSetting } from '../../round.ts';
import { UNIVERSE_SPECS, type UniverseSpec } from '../../universe.ts';
import { number, say, section, table } from '../say.ts';
import type { LexState, PageDef, PageSection } from '../types.ts';

/** A value of a setting as the table shows it: a named choice, yes or no, or a number. */
const shown = (
  choices: readonly { value: number; label: string }[] | undefined,
  value: number | boolean | undefined,
): string => {
  if (typeof value === 'boolean') return value ? 'ja' : 'nein';
  if (value === undefined) return '–';
  return choices?.find((c) => c.value === value)?.label ?? number(value);
};

const specRow = (spec: UniverseSpec, s: LexState): string[] => [
  spec.label,
  shown(spec.choices, s.u[spec.key]),
  shown(spec.choices, spec.def),
];

const roundRow = (setting: RoundSetting, s: LexState): string[] => {
  const choices = setting.kind === 'number' ? setting.choices : undefined;
  const value = (s.round as unknown as Record<string, number | boolean>)[
    setting.name
  ];
  return [setting.label, shown(choices, value), shown(choices, setting.def)];
};

/** The settings of the round that are no row of the universe settings: those set only in a new round. */
const roundOnly = (): RoundSetting[] =>
  ROUND_SETTINGS.filter((r) => r.kind === 'switch' || !r.live);

const sizeSection = (s: LexState): PageSection =>
  section(
    'size',
    'Tempo und Größe',
    say(
      'Dieses Universum läuft {speed}-mal so schnell wie das Original: Produktion, Bauzeiten, Forschungszeiten und Flüge laufen entsprechend schneller. Es hat {galaxies} Galaxien mit je {systems} Systemen, und jedes System hat {positions} Positionen für Planeten und danach die Expeditionsposition ({expedition}). Jeder Spieler hat einen Heimatplaneten. Der Server rechnet rund um die Uhr, auch wenn du nicht eingeloggt bist. Es gibt kein Premium und keine Dunkle Materie, nur Rohstoffe und Geduld.',
      {
        speed: number(s.u.speed),
        galaxies: number(s.u.galaxies),
        systems: number(s.u.systems),
        positions: number(s.u.positions),
        expedition: number(expeditionPosition(s.u)),
      },
    ),
  );

const settingsSection = (s: LexState): PageSection =>
  section(
    'settings',
    'Alle Einstellungen',
    say(
      'Diese Tabelle nennt jede Einstellung des Admins mit dem Wert, der in dieser Runde gilt, und dem Wert, mit dem eine neue Runde beginnt. Einstellungen, die der Admin nur beim Start einer Runde setzt, stehen darunter.',
    ),
    table(
      'Einstellungen des Universums',
      ['Einstellung', 'Wert in dieser Runde', 'Standard'],
      UNIVERSE_SPECS.map((spec) => specRow(spec, s)),
    ),
    table(
      'Einstellungen, die nur eine neue Runde setzt',
      ['Einstellung', 'Wert in dieser Runde', 'Standard'],
      roundOnly().map((setting) => roundRow(setting, s)),
    ),
  );

export const page: PageDef = {
  id: 'rule-universe',
  kind: 'rule',
  title: 'Dieses Universum',
  line: 'Die Einstellungen dieses Universums und dieser Runde, wie der Admin sie gewählt hat.',
  keywords: ['Universum', 'Einstellungen', 'Runde', 'Tempo', 'Größe'],
  seeAlso: [
    'rule-flight',
    'rule-planets',
    'rule-expeditions',
    'rule-endzeit',
    'rule-rewards',
  ],
  sections: (s) => [sizeSection(s), settingsSection(s)],
};
