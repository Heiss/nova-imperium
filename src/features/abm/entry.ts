// Issue #54, the Abfangrakete (okf/features/missiles.md): 8,000 Adamant,
// 0 Psikristall, 2,000 Promethium (owner, 2026-11-16, D2); one place in the
// Raketenkrypta; it stops one incoming Orbitalrakete [V]. Structure 8,000
// (from the cost), shield 1, attack 1, Raketenkrypta 2 and Orbitale
// Schiffsschmiede 1 [V]. It does not fight in a battle (owiki
// „Abfangrakete“: it stops nothing but Interplanetarraketen).
import type { DefenseFields } from '../../core/catalog.ts';
import type { Combat } from '../../core/components/combat.ts';
import type { Missile } from '../../core/components/silo.ts';
import type { Unit } from '../../core/components/unit.ts';

export const kind = 'defense';
export const order = 90;
export const unit: Unit = {
  cost: [8000, 0, 2000],
};
export const combat: Combat = {
  atk: 1,
  sh: 1,
};
export const missile: Missile = {
  slots: 1,
  intercepts: true,
};
export const def: DefenseFields = {
  req: {
    b: {
      silo: 2,
      yard: 1,
    },
  },
};
