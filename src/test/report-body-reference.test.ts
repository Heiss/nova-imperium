// The bodies of the battle, espionage and survey reports render as before
// #330 („no visible change“ of the issue; each migration step changes no
// behaviour, owner, 2026-11-13). The old HTML functions are frozen here:
// reportBodyHTML() of logic/report-body.ts with its helpers, and
// surveyBody() of logic/survey.ts. The components render the values of
// reportBody() instead. On generated reports of every kind (fixed fast-check
// seed 330, sampled once) both give the same markup up to what a browser
// does not show (normalize() of markup.ts); hand-built cases reach the rare
// branches and the shapes older versions stored, and a marks test shows that
// the cases reach every branch.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { PlanetActivity } from '../core/activity.ts';
import { BUILD, DEF, RES, SHIPS, UNIT } from '../core/catalog.ts';
import { countUnits } from '../core/flight.ts';
import type { Debris } from '../core/debris.ts';
import { PLANET_TYPE_NAMES } from '../core/planet-type.ts';
import type { Keyword, Span, SurveyFindings } from '../core/survey.ts';
import { text } from '../core/text.ts';
import type { Coords, Levels, Resources } from '../core/types.ts';
import { spyActivityText } from '../client/logic/activity.ts';
import { debrisLine } from '../client/logic/debris.ts';
import { coords, esc, fmt, resLine, techLine } from '../client/logic/format.ts';
import { moonLines } from '../client/logic/moon.ts';
import { moonbreakLines } from '../client/logic/moonbreak.ts';
import { COMPARE, KEYWORDS, ORBIT, SIZE } from '../client/logic/survey.ts';
import type { Report } from '../client/logic/types.ts';
import { normalize } from './markup.ts';
import { reportView } from './report-view.ts';

// ----- frozen: the bodies of src/client/logic/report-body.ts before #330 -----

function unitTable(before: Levels, after: Levels, keys: string[]): string {
  const ks = keys.filter((k) => (before[k] ?? 0) > 0);
  if (!ks.length) return '<span class="dim">keine Einheiten</span>';
  const rows = ks.map((k) => {
    const b = before[k]!;
    const a = after[k] ?? 0;
    return `<tr><td>${text(k)?.n}</td><td class="n">${fmt(b)}</td><td class="n">${fmt(a)}</td><td class="n ${b - a > 0 ? 'bad' : ''}">${fmt(b - a)}</td></tr>`;
  });
  return `<table class="mini"><tr><th>Einheit</th><th class="n">vorher</th><th class="n">nachher</th><th class="n">Verlust</th></tr>${rows.join('')}</table>`;
}

const WINNER: Record<string, string> = {
  att: 'Der Angreifer hat die Schlacht gewonnen!',
  def: 'Der Verteidiger hat die Schlacht gewonnen!',
  draw: 'Die Schlacht endet unentschieden.',
};

const lv = (x: unknown): Levels => (x as Levels | undefined) ?? {};

/** A fleet that held at the planet and defended it (#55). */
interface HeldSide {
  name: string;
  before: Levels;
  after: Levels;
  tech: Levels;
}

/** Each fleet that held fights as a defender of its own (#55). */
const heldSides = (r: Report): string =>
  ((r.held as HeldSide[] | undefined) ?? [])
    .map(
      (h) =>
        `<div><b class="good">Verteidiger ${esc(h.name)}</b><div class="dim">${techLine(lv(h.tech))}</div>${unitTable(lv(h.before), lv(h.after), Object.keys(SHIPS))}</div>`,
    )
    .join('');

/** A further fleet of an attack union that fought along (#225), with its share of the loot. */
interface JoinedSide extends HeldSide {
  loot?: Resources;
}

/** The share of the loot of one attacking fleet, when it took any. */
const share = (loot: Resources | undefined): string =>
  loot && loot.m + loot.c + loot.d
    ? `<div class="dim">Erbeutet: ${resLine(loot)}</div>`
    : '';

/** The block of the first attacker, then one of each further attacker of the union (#225). */
function attackerSides(r: Report): string {
  const block = (
    name: unknown,
    tech: unknown,
    before: unknown,
    after: unknown,
    loot?: Resources,
  ): string =>
    `<div><b class="fl-attack">Angreifer ${esc(name)}</b><div class="dim">${techLine(lv(tech))}</div>${unitTable(lv(before), lv(after), Object.keys(SHIPS))}${share(loot)}</div>`;
  const joined = (r.attackers as JoinedSide[] | undefined) ?? [];
  return [
    block(
      r.attName,
      r.attTech,
      r.attBefore,
      r.attAfter,
      r.attLoot as Resources | undefined,
    ),
    ...joined.map((j) => block(j.name, j.tech, j.before, j.after, j.loot)),
  ].join('');
}

function battleBody(r: Report): string {
  const rebuilt = lv(r.rebuilt);
  const loot = r.loot as Resources | undefined;
  const rb = countUnits(rebuilt)
    ? `<div class="dim">Wiederhergestellte Verteidigung: ${Object.entries(
        rebuilt,
      )
        .map(([k, n]) => `${fmt(n)} ${text(k)?.n}`)
        .join(', ')}</div>`
    : '';
  const lootLine =
    loot && loot.m + loot.c + loot.d ? `<br>Erbeutet: ${resLine(loot)}` : '';
  const debris = debrisLine(r.debris as Debris | undefined);
  const debrisHTML = [debris, ...moonLines(r), ...moonbreakLines(r)]
    .filter(Boolean)
    .map((line) => `<br>${line}`)
    .join('');
  return `<div>Schlacht bei ${esc(r.name)} ${coords(r.coords as Coords)} · ${esc(r.rounds)} Runde(n)</div>
  <div class="cols mt">${attackerSides(r)}
  <div><b class="good">Verteidiger ${esc(r.defName)}</b><div class="dim">${techLine(lv(r.defTech))}</div>${unitTable(lv(r.defBefore), lv(r.defAfter), Object.keys(UNIT))}${rb}</div>${heldSides(r)}</div>
  <p><b>${WINNER[String(r.winner)] ?? ''}</b>${lootLine}${debrisHTML}</p>`;
}

function section(title: string, o: unknown, keys: string[]): string {
  if (!o) return '';
  const list = unitList(lv(o), keys);
  return `<div class="mt"><b>${title}</b><br>${list || '<span class="dim">keine</span>'}</div>`;
}

/** The activity of the target, in reports since #175. */
function spyActivity(r: Report): string {
  const words = spyActivityText(
    r.activity as PlanetActivity | null | undefined,
  );
  return words === null
    ? ''
    : `<div class="mt"><b>Aktivität</b><br>${esc(words)}</div>`;
}

/** The ships of a section, „Name: n · …“, or none. */
const unitList = (o: Levels, keys: string[]): string =>
  keys
    .filter((k) => (o[k] ?? 0) > 0)
    .map((k) => `${text(k)?.n}: ${fmt(o[k])}`)
    .join(' · ');

/**
 * The fleets that hold at the planet, apart from its fleet, when the spy's
 * Auspex-Lehre reaches the round's level (#55, owner, 2026-11-17).
 */
function heldSection(r: Report): string {
  const held = r.held as { name: string; ships: Levels }[] | undefined;
  if (!held?.length) return '';
  const rows = held
    .map(
      (h) =>
        `${esc(h.name)}: ${unitList(lv(h.ships), Object.keys(SHIPS)) || '<span class="dim">keine</span>'}`,
    )
    .join('<br>');
  return `<div class="mt"><b>Gehaltene Flotten</b><br>${rows}</div>`;
}

function spyBody(r: Report): string {
  const lost = r.lost
    ? ' – <span class="bad">deine Spähschädel wurden zerstört!</span>'
    : '';
  const hint =
    !r.ships && !r.lost
      ? ' · Mehr Spähschädel oder Auspex-Lehre zeigen mehr Details.'
      : '';
  return `<div>Rohstoffe auf ${esc(r.name)} ${coords(r.coords as Coords)} (Spieler ${esc(r.defName)}):<br><b>${resLine(r.res as Resources)}</b></div>
   ${spyActivity(r)}${section('Flotte', r.ships, Object.keys(SHIPS))}${heldSection(r)}${section('Verteidigung', r.def, Object.keys(DEF))}${section('Gebäude', r.b, Object.keys(BUILD))}${section('Forschung', r.r, Object.keys(RES))}
   <div class="dim mt">Chance auf Auspex-Abwehr: ${esc(r.counter)} %${lost}${hint}</div>`;
}

/**
 * The body of a battle, espionage or survey report as HTML (their tables and
 * sections), or null for a report that is only text. The list of reports
 * (#118, bundle 4: logic/messages.ts, Messages.svelte) renders these bodies
 * with `{@html}` until they are components of their own.
 */
function reportBodyHTML(r: Report): string | null {
  if (r.type === 'battle') return battleBody(r);
  if (r.type === 'spy') return spyBody(r);
  if (r.type === 'survey') return surveyBody(r);
  return null;
}

// ----- frozen: the survey bodies of logic/survey.ts -----

/** The owner's sentence of D5: „Gemäßigter Planet in der mittleren Bahn, vermutlich groß.“ */
const guess = (f: SurveyFindings): string =>
  `${ORBIT[f.orbit].temp} Planet in der ${ORBIT[f.orbit].orbit} Bahn, vermutlich ${SIZE[f.size]}.`;

/** A number with German decimals, at most two („182,5“, „1,14“). */
const num = (n: number): string =>
  n.toLocaleString('de-DE', { maximumFractionDigits: 2 });

/** The planet spans 40 °C below its maximum temperature (the overview). */
const temps = (t: Span): string => `${t.min - 40} °C bis ${t.max} °C`;

const fieldSpan = (f: Span): string =>
  f.min === f.max ? fmt(f.min) : `ca. ${fmt(f.min)}–${fmt(f.max)}`;

/** The field range of the position, as the rough report names it. */
const positionRange = (f: SurveyFindings, p: number): string =>
  `Position ${p}: ${fmt(f.range.min)}–${fmt(f.range.max)} Felder`;

const list = (words: Keyword[]): string =>
  words.length ? words.map((k) => KEYWORDS[k]).join(', ') : 'keine';

/** The rough report: what the position lets one guess (D5). */
function rough(f: SurveyFindings, c: Coords): string {
  return `<div>Vermessung ${coords(c)} – Messung ungenau. ${guess(f)} ${positionRange(f, c.p)}, Temperatur um ${f.around} °C. Planetentyp: ${PLANET_TYPE_NAMES[f.planetType]}.</div>`;
}

/** The narrowed or exact fields and temperature (D2, from score 4 and 7). */
function closer(f: SurveyFindings, c: Coords): string {
  const fields = fieldSpan(f.fields!);
  const temp = f.tier === 'near' ? `ca. ${temps(f.temp!)}` : temps(f.temp!);
  return `<div>Vermessung ${coords(c)}. ${positionRange(f, c.p)}.</div>
   <table class="mini"><tr><td>Felder</td><td>${fields}</td></tr><tr><td>Temperatur</td><td>${temp}</td></tr><tr><td>Planetentyp</td><td>${PLANET_TYPE_NAMES[f.planetType]}</td></tr></table>`;
}

/** The full report: everything known about the planet (D6). */
function full(f: SurveyFindings, c: Coords): string {
  const x = f.full!;
  const rows: [string, string][] = [
    ['Temperatur', `${x.temp - 40} °C bis ${x.temp} °C`],
    ['Durchmesser', `${fmt(x.diameter)} km`],
    [
      'Felder',
      `${fmt(x.fields)} (Position ${c.p}: ${fmt(f.range.min)}–${fmt(f.range.max)}, Durchschnitt ${num(f.average)}) – ${COMPARE[x.compare]}`,
    ],
    ['Planetentyp', PLANET_TYPE_NAMES[f.planetType]],
    ['Promethium-Faktor', `×${num(x.factor)}`],
    ['Energie je Sonnenreliquiar', fmt(x.energy)],
    ['Vorteile', list(x.pros)],
    ['Nachteile', list(x.cons)],
  ];
  return `<div>Vermessung ${coords(c)}.</div>
   <table class="mini">${rows.map(([k, v]) => `<tr><td>${k}</td><td>${esc(v)}</td></tr>`).join('')}</table>`;
}

/** The body of a survey report in the messages. */
function surveyBody(r: Report): string {
  const f = r as unknown as SurveyFindings & { coords: Coords };
  if (f.tier === 'full' && f.full) return full(f, f.coords);
  if (f.fields && f.temp) return closer(f, f.coords);
  return rough(f, f.coords);
}

// ----- the comparison -----

/** Names a player typed: with everything that must stay escaped. */
const NAMES = ['Anna', 'Kain <i>&"\'</i>', '[Tag] Bert', 'Ödön', ''] as const;
const count = fc.constantFrom(0, 1, 2, 5, 999, 1000, 12_345);
const levels = (keys: string[]) =>
  fc.dictionary(fc.constantFrom(...keys), count, { maxKeys: 6 });
const ALL = [...Object.keys(UNIT), ...Object.keys(BUILD), ...Object.keys(RES)];
const tech = fc.record(
  {
    weapons: fc.nat(5),
    shield: fc.nat(5),
    armor: fc.nat(5),
  },
  { requiredKeys: [] },
);
const resources = fc.record({
  m: fc.constantFrom(0, 1, 7, 1000),
  c: fc.constantFrom(0, 2, 8, 20_000),
  d: fc.constantFrom(0, 3, 9, 300_000),
});
const place = fc.record({
  g: fc.integer({ min: 1, max: 9 }),
  s: fc.integer({ min: 1, max: 499 }),
  p: fc.integer({ min: 1, max: 15 }),
});
const name = fc.constantFrom(...NAMES);

/** A side of a battle, a fleet that held or one that joined the attack. */
const fleet = fc.record(
  {
    name,
    before: levels(ALL),
    after: levels(ALL),
    tech,
    loot: resources,
  },
  { requiredKeys: [] },
);

const battle = fc
  .record(
    {
      name,
      coords: place,
      rounds: fc.constantFrom(1, 2, 6, '<6>'),
      attName: name,
      defName: name,
      attTech: tech,
      defTech: tech,
      attBefore: levels(ALL),
      attAfter: levels(ALL),
      defBefore: levels(ALL),
      defAfter: levels(ALL),
      rebuilt: levels(Object.keys(DEF)),
      held: fc.array(fleet, { maxLength: 2 }),
      attackers: fc.array(fleet, { maxLength: 2 }),
      attLoot: resources,
      loot: resources,
      debris: fc.record({
        m: fc.constantFrom(0, 5, 1000),
        c: fc.constantFrom(0, 7, 2000),
      }),
      winner: fc.constantFrom('att', 'def', 'draw', 'other'),
      moonChance: fc.constantFrom(0, 1, 12.5, 20),
      moon: fc.boolean(),
      moonbreak: fc.record({
        chance: fc.constantFrom(0.5, 30, 100),
        broken: fc.boolean(),
        loss: fc.constantFrom(0, 10.25),
        lost: fc.boolean(),
      }),
      moonLost: fc.boolean(),
    },
    { requiredKeys: [] },
  )
  .map((o): Report => ({ ...REPORT, type: 'battle', ...o }));

const REPORT = { id: 'r1', time: 1, title: 'Bericht' };

const spy = fc
  .record(
    {
      name,
      defName: name,
      coords: place,
      res: resources,
      counter: fc.constantFrom(0, 12, 100, '<1>'),
      lost: fc.boolean(),
      activity: fc.constantFrom<PlanetActivity | null>(
        null,
        { recent: true } as PlanetActivity,
        { minutes: 1 } as PlanetActivity,
        { minutes: 15 } as PlanetActivity,
      ),
      ships: levels(Object.keys(SHIPS)),
      held: fc.array(fc.record({ name, ships: levels(Object.keys(SHIPS)) }), {
        maxLength: 2,
      }),
      def: levels(Object.keys(DEF)),
      b: levels(Object.keys(BUILD)),
      r: levels(Object.keys(RES)),
    },
    { requiredKeys: ['res'] },
  )
  .map((o): Report => ({ ...REPORT, type: 'spy', ...o }));

const keywords = fc.subarray<Keyword>(Object.keys(KEYWORDS) as Keyword[]);
const span = fc
  .tuple(fc.integer({ min: 1, max: 200 }), fc.integer({ min: 0, max: 80 }))
  .map(([min, d]): Span => ({ min, max: min + d }));

const survey = fc
  .record(
    {
      tier: fc.constantFrom('rough', 'near', 'exact', 'full'),
      planetType: fc.constantFrom(
        ...(Object.keys(
          PLANET_TYPE_NAMES,
        ) as (keyof typeof PLANET_TYPE_NAMES)[]),
      ),
      range: span,
      average: fc.constantFrom(100, 182.5, 1.14),
      around: fc.integer({ min: -20, max: 120 }),
      orbit: fc.constantFrom(...(Object.keys(ORBIT) as (keyof typeof ORBIT)[])),
      size: fc.constantFrom(...(Object.keys(SIZE) as (keyof typeof SIZE)[])),
      fields: span,
      temp: span,
      full: fc.record({
        temp: fc.integer({ min: 0, max: 120 }),
        diameter: fc.integer({ min: 4000, max: 20_000 }),
        fields: fc.integer({ min: 40, max: 300 }),
        compare: fc.constantFrom(
          ...(Object.keys(COMPARE) as (keyof typeof COMPARE)[]),
        ),
        factor: fc.constantFrom(0.9, 1, 1.14, 1.5),
        energy: fc.integer({ min: 10, max: 300 }),
        pros: keywords,
        cons: keywords,
      }),
      coords: place,
    },
    {
      requiredKeys: [
        'tier',
        'planetType',
        'range',
        'average',
        'around',
        'orbit',
        'size',
        'coords',
      ],
    },
  )
  .map((o): Report => ({ ...REPORT, type: 'survey', ...o }));

/** What a report stored by an older version holds: fields it lacks, and extras. */
const HAND_BUILT: [string, Report][] = [
  // Battles: the shape of #29 (the first one) and what each issue added.
  [
    'the first battle report: no tech, no rebuilt, no loot, no debris',
    {
      ...REPORT,
      type: 'battle',
      name: 'Beta',
      coords: { g: 1, s: 2, p: 6 },
      rounds: 3,
      attName: 'Anna',
      defName: 'Bert',
      attBefore: { lf: 4 },
      attAfter: { lf: 1 },
      defBefore: { lf: 2, rl: 3 },
      defAfter: { rl: 1 },
      winner: 'draw',
    },
  ],
  [
    'a battle without coordinates, names and rounds',
    { ...REPORT, type: 'battle', winner: 'att' },
  ],
  [
    'a battle with a nameless unknown winner and a unit that grew',
    {
      ...REPORT,
      type: 'battle',
      attBefore: { lf: 3, rl: 4 },
      attAfter: { lf: 5 },
      defBefore: { lf: 1, rl: 4, sc: 0 },
      defAfter: {},
    },
  ],
  [
    'a battle with loot, rebuilt defense and a debris field (#45)',
    {
      ...REPORT,
      type: 'battle',
      name: 'Beta',
      coords: { g: 1, s: 2, p: 6 },
      rounds: 6,
      attName: 'Anna',
      defName: 'Bert',
      attBefore: { lf: 4 },
      attAfter: { lf: 4 },
      defBefore: { rl: 3 },
      defAfter: {},
      rebuilt: { rl: 2, ll: 1 },
      loot: { m: 0, c: 0, d: 2 },
      debris: { m: 0, c: 7 },
      attTech: { weapons: 2, shield: 1 },
      defTech: { armor: 3 },
      winner: 'att',
    },
  ],
  [
    'a battle with zero loot, zero debris and an empty rebuilt',
    {
      ...REPORT,
      type: 'battle',
      winner: 'def',
      loot: { m: 0, c: 0, d: 0 },
      debris: { m: 0, c: 0 },
      rebuilt: { rl: 0 },
    },
  ],
  [
    'a battle with a moon chance that did not form a moon (#53)',
    { ...REPORT, type: 'battle', winner: 'att', moonChance: 20 },
  ],
  [
    'a battle with a formed moon',
    { ...REPORT, type: 'battle', winner: 'att', moonChance: 20, moon: true },
  ],
  [
    'a battle with a moon chance of 0 and a moon flag',
    { ...REPORT, type: 'battle', winner: 'att', moonChance: 0, moon: true },
  ],
  [
    'a Mondbruch: the moon broke and the Weltenbrecher were lost (#95)',
    {
      ...REPORT,
      type: 'battle',
      coords: { g: 1, s: 2, p: 6 },
      winner: 'att',
      moonbreak: { chance: 30, broken: true, loss: 10, lost: true },
      moonLost: true,
    },
  ],
  [
    'a Mondbruch: the moon held and nothing was lost',
    {
      ...REPORT,
      type: 'battle',
      winner: 'att',
      moonbreak: { chance: 12.345, broken: false, loss: 5, lost: false },
    },
  ],
  [
    'a battle with the fleets that held (#55)',
    {
      ...REPORT,
      type: 'battle',
      winner: 'def',
      held: [
        {
          name: 'Cora <b>',
          before: { sc: 2 },
          after: { sc: 1 },
          tech: { weapons: 1 },
        },
        { name: 'Dirk', before: {}, after: {}, tech: {} },
        { name: 'Eva', before: { sc: 5 }, after: { sc: 5 } },
      ],
    },
  ],
  [
    'the union attack with several attackers and their shares (#225)',
    {
      ...REPORT,
      type: 'battle',
      winner: 'att',
      attName: 'Cora',
      attBefore: { lf: 5 },
      attAfter: { lf: 5 },
      attLoot: { m: 20, c: 15, d: 10 },
      loot: { m: 30, c: 20, d: 10 },
      attackers: [
        {
          name: 'Emil <i>',
          before: { lf: 3 },
          after: { lf: 2 },
          tech: { weapons: 1, shield: 2, armor: 3 },
          loot: { m: 10, c: 5, d: 0 },
        },
        { name: 'Fred', before: { lf: 1 }, after: { lf: 1 }, tech: {} },
      ],
    },
  ],
  [
    'a union attack without any loot, and an empty list of attackers',
    {
      ...REPORT,
      type: 'battle',
      winner: 'def',
      attackers: [
        {
          name: 'Emil',
          before: {},
          after: {},
          tech: {},
          loot: { m: 0, c: 0, d: 0 },
        },
      ],
    },
  ],
  [
    'a battle with an empty list of attackers and of held fleets',
    { ...REPORT, type: 'battle', winner: 'draw', attackers: [], held: [] },
  ],
  // Espionage reports.
  [
    'the first espionage report: resources only, no activity (before #175)',
    {
      ...REPORT,
      type: 'spy',
      name: 'Beta <i>',
      defName: 'Bert <i>',
      coords: { g: 1, s: 2, p: 6 },
      res: { m: 5, c: 4, d: 3 },
      counter: 12,
    },
  ],
  [
    'a report of a shot-down spying: the probes were destroyed, no hint',
    {
      ...REPORT,
      type: 'spy',
      res: { m: 0, c: 0, d: 0 },
      counter: 100,
      lost: true,
    },
  ],
  [
    'an espionage report with every part, the activity and the held fleets',
    {
      ...REPORT,
      type: 'spy',
      res: { m: 5, c: 4, d: 3 },
      counter: 12,
      activity: { recent: true },
      ships: { lf: 2, sc: 1000, rl: 5 },
      held: [
        { name: 'Cora', ships: { sc: 1, lf: 2 } },
        { name: 'Dirk <b>', ships: {} },
      ],
      def: { rl: 3 },
      b: { metal: 3 },
      r: { spy: 2 },
    },
  ],
  [
    'an espionage report with parts without units, no activity in the hour',
    {
      ...REPORT,
      type: 'spy',
      res: { m: 1, c: 1, d: 1 },
      counter: 0,
      activity: null,
      ships: {},
      def: { rl: 0 },
      b: {},
      r: {},
      held: [],
    },
  ],
  [
    'an espionage report with an activity of minutes',
    {
      ...REPORT,
      type: 'spy',
      res: { m: 1, c: 1, d: 1 },
      counter: 3,
      activity: { minutes: 15 },
      ships: { lf: 1 },
    },
  ],
  // Survey reports of every tier.
  ...(['rough', 'near', 'exact', 'full'] as const).map(
    (tier): [string, Report] => [
      `a ${tier} survey report`,
      {
        ...REPORT,
        type: 'survey',
        tier,
        coords: { g: 1, s: 42, p: 9 },
        planetType: 'dschungel',
        range: { min: 150, max: 246 },
        average: 182.5,
        around: 50,
        orbit: 'middle',
        size: 'medium',
        ...(tier !== 'rough' && {
          fields:
            tier === 'near' ? { min: 160, max: 200 } : { min: 180, max: 180 },
          temp: tier === 'near' ? { min: 60, max: 80 } : { min: 70, max: 70 },
        }),
        ...(tier === 'full' && {
          full: {
            temp: 70,
            diameter: 12_345,
            fields: 180,
            compare: 'below',
            factor: 1.14,
            energy: 55,
            pros: ['goodFactor', 'muchEnergy'],
            cons: [],
          },
        }),
      },
    ],
  ),
  [
    'a full survey with no benefits and a drawback, an inner orbit',
    {
      ...REPORT,
      type: 'survey',
      tier: 'full',
      coords: { g: 2, s: 3, p: 2 },
      planetType: 'gas',
      range: { min: 10, max: 10 },
      average: 100,
      around: 90,
      orbit: 'inner',
      size: 'small',
      full: {
        temp: 90,
        diameter: 4000,
        fields: 10,
        compare: 'above',
        factor: 1,
        energy: 10,
        pros: [],
        cons: ['fewFields', 'weakFactor'],
      },
    },
  ],
  [
    'an outer survey whose tier says full but holds no table, and one with fields but no temperature',
    {
      ...REPORT,
      type: 'survey',
      tier: 'full',
      coords: { g: 2, s: 3, p: 14 },
      planetType: 'eis',
      range: { min: 10, max: 20 },
      average: 15,
      around: -5,
      orbit: 'outer',
      size: 'large',
      fields: { min: 1, max: 2 },
    },
  ],
  // Reports that are only text have no body.
  ['an info report', { ...REPORT, type: 'info', text: 'Hallo <b>' }],
];

/** Normalized markup of every branch of the bodies, for the check that the cases reach them. */
const MARKS = [
  '<b class="fl-attack">Angreifer Anna</b>',
  '<b class="fl-attack">Angreifer Cora</b>',
  '<b class="fl-attack">Angreifer Emil &lt;i>',
  '<b class="good">Verteidiger Bert</b>',
  '<b class="good">Verteidiger Cora &lt;b></b>',
  '<b class="good">Verteidiger Dirk</b>',
  '<b class="good">Verteidiger Kain &lt;i>&amp;"\'&lt;/i></b>',
  '<span class="dim">keine Einheiten</span>',
  '<td class="n bad">',
  '<td class="n ">',
  '<td class="n ">-2</td>',
  'Wiederhergestellte Verteidigung:',
  '<div class="dim">Erbeutet: ',
  '<br>Erbeutet: ',
  'Der Angreifer hat die Schlacht gewonnen!',
  'Der Verteidiger hat die Schlacht gewonnen!',
  'Die Schlacht endet unentschieden.',
  '<b></b>',
  '<br>Es entstand ein Trümmerfeld mit ',
  '<br>Mondchance: ',
  'ziehen sich an und formen einen Trabanten',
  'Der Mond ist zerbrochen (Chance ',
  'Der Mond hält stand (Chance ',
  'Die Weltenbrecher wurden vom eigenen Schuss zerrissen',
  'Dein Mond bei [1:2:6] wurde zerstört.',
  'Schlacht bei [?]',
  '&lt;6> Runde(n)',
  'Rohstoffe auf ',
  '<b>Aktivität</b><br>Aktiv</div>',
  '<br>Aktivität vor 15 Minuten</div>',
  '<br>Keine Aktivität in der letzten Stunde.</div>',
  '<b>Flotte</b><br>',
  '<b>Gehaltene Flotten</b><br>',
  '<b>Verteidigung</b><br>',
  '<b>Gebäude</b><br>',
  '<b>Forschung</b><br>',
  '<br><span class="dim">keine</span></div>',
  '<br>Dirk &lt;b>: <span class="dim">keine</span>',
  ': <span class="dim">keine</span><br>',
  'Abwehr: &lt;1> %',
  ' – <span class="bad">deine Spähschädel wurden zerstört!</span>',
  ' · Mehr Spähschädel oder Auspex-Lehre zeigen mehr Details.',
  'Messung ungenau.',
  '<td>Temperatur</td><td>ca. ',
  '<td>Temperatur</td><td>30 °C bis 70 °C</td>',
  '<td>Felder</td><td>180</td>',
  '<td>Felder</td><td>ca. 160–200</td>',
  '<td>Felder</td><td>180 (Position 9: 150–246, Durchschnitt 182,5) – unterdurchschnittlich</td>',
  '<td>Durchmesser</td>',
  '<td>Vorteile</td><td>keine</td>',
  '<td>Nachteile</td><td>keine</td>',
  'Heißer Planet in der inneren Bahn',
  'Kalter Planet in der äußeren Bahn',
  'vermutlich groß.',
  '– überdurchschnittlich</td>',
  '– unterdurchschnittlich</td>',
];

const RUNS = 100;

/**
 * The sample (seed 330, 100 reports of each kind), generated once and used
 * by every test that needs it.
 */
let sample: Record<'battle' | 'spy' | 'survey', Report[]> | undefined;
function SAMPLE(): Record<'battle' | 'spy' | 'survey', Report[]> {
  if (!sample) {
    const draw = (arb: fc.Arbitrary<Report>): Report[] =>
      fc.sample(arb, { seed: 330, numRuns: RUNS });
    sample = { battle: draw(battle), spy: draw(spy), survey: draw(survey) };
  }
  return sample;
}

const same = (r: Report, label: string): void => {
  const old = reportBodyHTML(r);
  const now = reportView(r);
  expect(now === null, label).toBe(old === null);
  if (old !== null) expect(normalize(now!), label).toBe(normalize(old));
};

describe('The bodies of the reports against the HTML before #330', () => {
  it.each(['battle', 'spy', 'survey'] as const)(
    'renders the generated %s reports as before',
    (kind) => {
      expect(SAMPLE()[kind]).toHaveLength(RUNS);
      SAMPLE()[kind].forEach((r, i) => same(r, `${kind} ${i}`));
    },
  );

  it('renders the hand-built cases as before', () => {
    for (const [label, r] of HAND_BUILT) same(r, label);
  });

  it('reaches every branch', () => {
    const seen = new Set<string>();
    const all = [
      ...Object.values(SAMPLE()).flat(),
      ...HAND_BUILT.map(([, r]) => r),
    ];
    for (const r of all) {
      const html = reportView(r);
      if (html === null) continue;
      const shown = normalize(html);
      for (const mark of MARKS) if (shown.includes(mark)) seen.add(mark);
    }
    expect([...seen].sort()).toEqual([...MARKS].sort());
  });
});
