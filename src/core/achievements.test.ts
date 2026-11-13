// The achievement list itself (names, targets, rewards): its texts and
// numbers are game content, so they are checked exactly.
import { describe, expect, it } from 'vitest';
import {
  ACHIEVEMENTS,
  CATEGORIES,
  dailyReward,
  type Achievement,
} from './achievements.ts';
import { BUILD, DEF, RES, SHIPS } from './catalog.ts';
import { lvlCost } from './economy.ts';
import { text } from './text.ts';

const LEVELS = [1, 2, 3, 5, 8, 10, 12, 15, 20];
const UNITS = [1, 5, 10, 25, 50, 100, 250, 500];
const ACTIONS = [1, 3, 5, 10, 25, 50, 100, 250];

const of = (metric: string): Achievement[] =>
  ACHIEVEMENTS.filter((a) => a.metric === metric);

describe('achievements', () => {
  it('names the categories', () => {
    expect(CATEGORIES).toEqual({
      buildings: 'Gebäude',
      research: 'Forschung',
      ships: 'Schiffe',
      defense: 'Verteidigung',
      fleet: 'Flotten',
      yard: 'Schiffsschmiede',
    });
  });

  it('has one series per entry and two for actions, with unique ids', () => {
    const levels = Object.keys(BUILD).length + Object.keys(RES).length;
    const units = Object.keys(SHIPS).length + Object.keys(DEF).length;
    expect(ACHIEVEMENTS).toHaveLength(
      levels * LEVELS.length + units * UNITS.length + 2 * ACTIONS.length,
    );
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(
      ACHIEVEMENTS.length,
    );
    for (const a of ACHIEVEMENTS) {
      expect(a.metric, a.id).toBe(`${a.category}:${a.metric.split(':')[1]}`);
      expect(a.id).toBe(`${a.metric}:${a.target}`);
    }
  });

  it('rewards building levels with 5 % of the level cost, at least 1', () => {
    const metal = of('buildings:metal');
    expect(metal.map((a) => a.target)).toEqual(LEVELS);
    expect(metal[0]).toEqual({
      id: 'buildings:metal:1',
      metric: 'buildings:metal',
      category: 'buildings',
      title: `${text('metal')!.n} auf Stufe 1`,
      target: 1,
      // 60 × 5 % = 3, 15 × 5 % = 0.75 → 1, nothing stays 0
      reward: [3, 1, 0],
    });
    for (const a of metal)
      expect(a.reward).toEqual(
        lvlCost(BUILD.metal!, a.target).map((v) =>
          v ? Math.min(30_000, Math.max(1, Math.floor(v * 0.05))) : 0,
        ),
      );
    const energy = of('research:energy');
    expect(energy.map((a) => a.title)).toEqual(
      LEVELS.map((n) => `${text('energy')!.n} auf Stufe ${n}`),
    );
    expect(energy.every((a) => a.category === 'research')).toBe(true);
  });

  it('rewards units with 2.5 % of their cost per unit, at most 30,000', () => {
    const probe = of('ships:probe');
    expect(probe.map((a) => a.target)).toEqual(UNITS);
    expect(probe.map((a) => a.title)).toEqual(
      UNITS.map((n) => `${n}× ${text('probe')!.n} besitzen`),
    );
    // 1,000 crystal × 2.5 % per unit
    expect(probe[0]!.reward).toEqual([0, 25, 0]);
    expect(probe.at(-1)!.reward).toEqual([0, 12_500, 0]);
    expect(of('ships:dstar').at(-1)!.reward).toEqual([30_000, 30_000, 30_000]);
    expect(of('defense:rl')[0]!.category).toBe('defense');
  });

  it('counts sent fleets and shipyard orders', () => {
    const send = of('fleet:send');
    expect(send.map((a) => a.title)).toEqual(
      ACTIONS.map((n) => `${n} Flotten starten`),
    );
    expect(send.map((a) => a.reward)).toEqual(
      ACTIONS.map((n) => [n * 15, n * 8, n * 3]),
    );
    expect(send.every((a) => a.category === 'fleet')).toBe(true);
    const order = of('yard:order');
    expect(order.map((a) => a.title)).toEqual(
      ACTIONS.map((n) => `${n} Aufträge an die Schiffsschmiede erteilen`),
    );
    expect(order.map((a) => a.reward)).toEqual(
      ACTIONS.map((n) => [n * 12, n * 6, n * 2]),
    );
    expect(order.every((a) => a.category === 'yard')).toBe(true);
  });

  it('grows the daily reward for seven days', () => {
    expect(dailyReward(0)).toEqual([30, 15, 2]);
    expect(dailyReward(1)).toEqual([30, 15, 2]);
    expect(dailyReward(2)).toEqual([40, 20, 4]);
    expect(dailyReward(7)).toEqual([90, 45, 14]);
    expect(dailyReward(9)).toEqual([90, 45, 14]);
  });
});
