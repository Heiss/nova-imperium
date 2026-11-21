// Issue #54, the Interplanetarrakete as the Orbitalrakete (okf/features/
// missiles.md): 12,500 Adamant, 2,500 Psikristall, 10,000 Promethium, attack
// 12,000 (owner, 2026-11-16, Q1); two places in the Raketenkrypta.
// Structure 15,000 (from the cost), shield 1, Raketenkrypta 4, Orbitale
// Schiffsschmiede 1 and Plasma-Impulsantrieb 1 [V]. It is launched from the
// Sternenkarte (the mission `missile`) and does not fight in a battle.
import type { DefenseFields } from '../../core/catalog.ts';
import type { Combat } from '../../core/components/combat.ts';
import type { Missile } from '../../core/components/silo.ts';
import type { Unit } from '../../core/components/unit.ts';

export const kind = 'defense';
export const order = 100;
export const unit: Unit = {
  cost: [12500, 2500, 10000],
};
export const combat: Combat = {
  atk: 12000,
  sh: 1,
};
export const missile: Missile = {
  slots: 2,
};
export const def: DefenseFields = {
  req: {
    b: {
      silo: 4,
      yard: 1,
    },
    r: {
      impulse: 1,
    },
  },
};
