// The bodies of the battle, espionage and survey reports as HTML (#118,
// bundle 4), on reports built by hand: the exact markup, so a changed word,
// number or tag shows. `src/test/messages-reference.test.ts` compares them
// with the frozen view on generated states.
import { describe, expect, it } from 'vitest';
import { text } from '../../core/text.ts';
import { reportBodyHTML } from './report-body.ts';
import type { Report } from './types.ts';

const n = (key: string): string => text(key)!.n;

const report = (type: Report['type'], o: Record<string, unknown>): Report => ({
  id: 'r1',
  time: 1,
  title: 'Bericht',
  type,
  name: 'Beta <i>',
  coords: { g: 1, s: 2, p: 6 },
  ...o,
});

const html = (type: Report['type'], o: Record<string, unknown>): string =>
  reportBodyHTML(report(type, o))!;

const HEAD =
  '<table class="mini"><tr><th>Einheit</th><th class="n">vorher</th><th class="n">nachher</th><th class="n">Verlust</th></tr>';

const TECH = (w: number, s: number, a: number): string =>
  `<div class="dim">Waffen ${w}% · Schilde ${s}% · Panzerung ${a}%</div>`;

/** A battle with only the fields it must have; the sides hold no units. */
const battle = (o: Record<string, unknown> = {}): string =>
  html('battle', {
    rounds: 1,
    attName: 'A',
    defName: 'B',
    winner: 'att',
    ...o,
  });

describe('the body of a report', () => {
  it('is only made for a battle, an espionage and a survey report', () => {
    expect(reportBodyHTML(report('info', { text: 'Hallo' }))).toBeNull();
    expect(
      reportBodyHTML(
        report('survey', {
          tier: 'rough',
          orbit: 'middle',
          size: 'large',
          range: { min: 100, max: 200 },
          around: 20,
          planetType: 'normal',
        }),
      ),
    ).toMatch(/^<div>Vermessung \[1:2:6\] – Messung ungenau\./);
    expect(reportBodyHTML(report('battle', { rounds: 1 }))).toMatch(
      /^<div>Schlacht bei /,
    );
    expect(
      reportBodyHTML(report('spy', { res: { m: 0, c: 0, d: 0 } })),
    ).toMatch(/^<div>Rohstoffe auf /);
  });
});

describe('the body of a battle report', () => {
  it('shows the sides, the loss of each unit, the winner and what the battle left', () => {
    const body = html('battle', {
      rounds: 3,
      attName: 'Anna',
      defName: 'Bert',
      attTech: { weapons: 2, shield: 1 },
      defTech: { armor: 3 },
      attBefore: { lf: 4, sc: 0 },
      attAfter: { lf: 1 },
      defBefore: { lf: 2, rl: 3 },
      defAfter: { rl: 1 },
      rebuilt: { rl: 2, ll: 1 },
      held: [
        {
          name: 'Cora <b>',
          before: { sc: 5 },
          after: { sc: 5 },
          tech: { weapons: 1 },
        },
      ],
      winner: 'att',
      loot: { m: 5, c: 4, d: 3 },
      debris: { m: 1000, c: 20 },
      moonChance: 12,
      moon: true,
      moonbreak: { chance: 30, broken: true, loss: 10, lost: true },
      moonLost: true,
    });
    expect(body).toBe(
      `<div>Schlacht bei Beta &lt;i&gt; [1:2:6] · 3 Runde(n)</div>
  <div class="cols mt"><div><b class="fl-attack">Angreifer Anna</b>${TECH(20, 10, 0)}${HEAD}<tr><td>${n('lf')}</td><td class="n">4</td><td class="n">1</td><td class="n bad">3</td></tr></table></div>
  <div><b class="good">Verteidiger Bert</b>${TECH(0, 0, 30)}${HEAD}<tr><td>${n('lf')}</td><td class="n">2</td><td class="n">0</td><td class="n bad">2</td></tr><tr><td>${n('rl')}</td><td class="n">3</td><td class="n">1</td><td class="n bad">2</td></tr></table><div class="dim">Wiederhergestellte Verteidigung: 2 ${n('rl')}, 1 ${n('ll')}</div></div><div><b class="good">Verteidiger Cora &lt;b&gt;</b>${TECH(10, 0, 0)}${HEAD}<tr><td>${n('sc')}</td><td class="n">5</td><td class="n">5</td><td class="n ">0</td></tr></table></div></div>
  <p><b>Der Angreifer hat die Schlacht gewonnen!</b><br>Erbeutet: Adamant 5 · Psikristall 4 · Promethium 3<br>Es entstand ein Trümmerfeld mit 1.000 Adamant und 20 Psikristall.<br>Mondchance: 12 %<br>Die enormen Mengen an freiem Adamant und Psikristall ziehen sich an und formen einen Trabanten um den Planeten.<br>Der Mond ist zerbrochen (Chance 30 %).<br>Die Weltenbrecher wurden vom eigenen Schuss zerrissen (Chance 10 %).<br>Dein Mond bei [1:2:6] wurde zerstört.</p>`,
    );
  });

  it('says „keine Einheiten“ for a side without units and shows no extra lines', () => {
    expect(battle({ winner: 'def' })).toBe(
      `<div>Schlacht bei Beta &lt;i&gt; [1:2:6] · 1 Runde(n)</div>
  <div class="cols mt"><div><b class="fl-attack">Angreifer A</b>${TECH(0, 0, 0)}<span class="dim">keine Einheiten</span></div>
  <div><b class="good">Verteidiger B</b>${TECH(0, 0, 0)}<span class="dim">keine Einheiten</span></div></div>
  <p><b>Der Verteidiger hat die Schlacht gewonnen!</b></p>`,
    );
  });

  it('names the winner, or nothing for an unknown result', () => {
    expect(battle({ winner: 'att' })).toContain(
      '<b>Der Angreifer hat die Schlacht gewonnen!</b>',
    );
    expect(battle({ winner: 'draw' })).toContain(
      '<b>Die Schlacht endet unentschieden.</b>',
    );
    expect(battle({ winner: 'x' })).toContain('<p><b></b></p>');
    expect(battle({ winner: undefined })).toContain('<p><b></b></p>');
  });

  it('lists only the units that were there, ships for the attacker, ships and defense for the defender', () => {
    const body = battle({
      attBefore: { lf: 3, rl: 4 },
      attAfter: { lf: 5 },
      defBefore: { lf: 1, rl: 4, sc: 0 },
      defAfter: {},
    });
    // A unit that grew is no loss, and a defense is no ship of the attacker.
    expect(body).toContain(
      `${HEAD}<tr><td>${n('lf')}</td><td class="n">3</td><td class="n">5</td><td class="n ">-2</td></tr></table>`,
    );
    expect(body).toContain(
      `${HEAD}<tr><td>${n('lf')}</td><td class="n">1</td><td class="n">0</td><td class="n bad">1</td></tr><tr><td>${n('rl')}</td><td class="n">4</td><td class="n">0</td><td class="n bad">4</td></tr></table>`,
    );
    expect(body).not.toContain(n('sc'));
  });

  it('shows the loot only when something was taken', () => {
    expect(battle({ loot: { m: 0, c: 0, d: 0 } })).not.toContain('Erbeutet');
    expect(battle({})).not.toContain('Erbeutet');
    expect(battle({ loot: { m: 0, c: 0, d: 2 } })).toContain(
      '<br>Erbeutet: Adamant 0 · Psikristall 0 · Promethium 2',
    );
    expect(battle({ loot: { m: 1, c: 0, d: 0 } })).toContain('Erbeutet');
    expect(battle({ loot: { m: 0, c: 3, d: 0 } })).toContain('Erbeutet');
  });

  it('shows the rebuilt defense only when something was rebuilt', () => {
    expect(battle({ rebuilt: {} })).not.toContain('Wiederhergestellte');
    expect(battle({ rebuilt: { rl: 0 } })).not.toContain('Wiederhergestellte');
    expect(battle({})).not.toContain('Wiederhergestellte');
    expect(battle({ rebuilt: { rl: 1000 } })).toContain(
      `<div class="dim">Wiederhergestellte Verteidigung: 1.000 ${n('rl')}</div></div>`,
    );
  });

  it('shows the lines after the winner one per line, and none for nothing', () => {
    expect(battle({ debris: { m: 0, c: 0 } })).toContain('</b></p>');
    expect(battle({ debris: { m: 0, c: 7 } })).toContain(
      '</b><br>Es entstand ein Trümmerfeld mit 0 Adamant und 7 Psikristall.</p>',
    );
    expect(battle({ moonChance: 5, moonLost: true })).toContain(
      '</b><br>Mondchance: 5 %<br>Dein Mond bei [1:2:6] wurde zerstört.</p>',
    );
  });

  it('shows each fleet that held as a defender of its own, none when none held', () => {
    expect(battle({ held: [] })).not.toContain('Verteidiger Cora');
    const body = battle({
      held: [
        { name: 'Cora', before: { sc: 2 }, after: { sc: 1 }, tech: {} },
        { name: 'Dirk', before: {}, after: {}, tech: { shield: 2 } },
      ],
    });
    expect(body).toContain(
      `<div><b class="good">Verteidiger Cora</b>${TECH(0, 0, 0)}${HEAD}<tr><td>${n('sc')}</td><td class="n">2</td><td class="n">1</td><td class="n bad">1</td></tr></table></div><div><b class="good">Verteidiger Dirk</b>${TECH(0, 20, 0)}<span class="dim">keine Einheiten</span></div></div>`,
    );
  });

  it('escapes the names and the number of rounds', () => {
    const body = battle({ attName: '<a>', defName: '"b"', rounds: '<6>' });
    expect(body).toContain('Angreifer &lt;a&gt;</b>');
    expect(body).toContain('Verteidiger &quot;b&quot;</b>');
    expect(body).toContain('&lt;6&gt; Runde(n)');
  });
});

describe('the body of an espionage report', () => {
  const spy = (o: Record<string, unknown> = {}): string =>
    html('spy', {
      defName: 'Bert <i>',
      res: { m: 5, c: 4, d: 3 },
      counter: 12,
      ...o,
    });
  const TOP =
    '<div>Rohstoffe auf Beta &lt;i&gt; [1:2:6] (Spieler Bert &lt;i&gt;):<br><b>Adamant 5 · Psikristall 4 · Promethium 3</b></div>\n   ';

  it('shows the resources and the chance of the counter-espionage, and a hint for a report with no details', () => {
    expect(spy()).toBe(
      `${TOP}\n   <div class="dim mt">Chance auf Auspex-Abwehr: 12 % · Mehr Spähschädel oder Auspex-Lehre zeigen mehr Details.</div>`,
    );
  });

  it('says that the spy skulls were destroyed, without the hint', () => {
    const body = spy({ lost: true });
    expect(body).toContain(
      '<div class="dim mt">Chance auf Auspex-Abwehr: 12 % – <span class="bad">deine Spähschädel wurden zerstört!</span></div>',
    );
    expect(body).not.toContain('Mehr Spähschädel');
  });

  it('shows every part that the spy saw, in its order', () => {
    const body = spy({
      activity: { recent: true },
      ships: { lf: 2, sc: 1000, rl: 5 },
      held: [
        { name: 'Cora', ships: { sc: 1, lf: 2 } },
        { name: 'Dirk <b>', ships: {} },
      ],
      def: { rl: 3 },
      b: { metal: 3 },
      r: { spy: 2 },
    });
    expect(body).toBe(
      `${TOP}<div class="mt"><b>Aktivität</b><br>Aktiv</div><div class="mt"><b>Flotte</b><br>${n('sc')}: 1.000 · ${n('lf')}: 2</div><div class="mt"><b>Gehaltene Flotten</b><br>Cora: ${n('sc')}: 1 · ${n('lf')}: 2<br>Dirk &lt;b&gt;: <span class="dim">keine</span></div><div class="mt"><b>Verteidigung</b><br>${n('rl')}: 3</div><div class="mt"><b>Gebäude</b><br>${n('metal')}: 3</div><div class="mt"><b>Forschung</b><br>${n('spy')}: 2</div>\n   <div class="dim mt">Chance auf Auspex-Abwehr: 12 %</div>`,
    );
  });

  it('says „keine“ for a part without any unit, and leaves out a part the spy did not see', () => {
    const body = spy({ ships: {}, def: { rl: 0 } });
    expect(body).toContain(
      '<div class="mt"><b>Flotte</b><br><span class="dim">keine</span></div>',
    );
    expect(body).toContain(
      '<div class="mt"><b>Verteidigung</b><br><span class="dim">keine</span></div>',
    );
    expect(body).not.toContain('Gebäude');
    expect(body).not.toContain('Forschung');
    expect(body).not.toContain('Gehaltene Flotten');
  });

  it('shows no held fleets for an empty list', () => {
    expect(spy({ held: [] })).not.toContain('Gehaltene Flotten');
  });

  it('shows the activity of the target: its words, or that there was none, or nothing for an old report', () => {
    expect(spy({ activity: { minutes: 15 } })).toContain(
      '<div class="mt"><b>Aktivität</b><br>Aktivität vor 15 Minuten</div>',
    );
    expect(spy({ activity: null })).toContain(
      '<div class="mt"><b>Aktivität</b><br>Keine Aktivität in der letzten Stunde.</div>',
    );
    expect(spy({})).not.toContain('Aktivität');
  });

  it('adds the hint when the report shows no ships and no skulls were lost', () => {
    expect(spy()).toContain(
      'Chance auf Auspex-Abwehr: 12 % · Mehr Spähschädel oder Auspex-Lehre zeigen mehr Details.</div>',
    );
    expect(spy({ ships: { lf: 1 } })).not.toContain('Mehr Spähschädel');
  });

  it('escapes the counter value', () => {
    expect(spy({ counter: '<1>' })).toContain('Abwehr: &lt;1&gt; %');
  });
});
