// The browser side of „Zurückbauen“ (#202): which rows offer it, the
// owner's sentences, the confirmation, the mark of a finished order and the
// settings of „Neue Runde“.
import { describe, expect, it, vi } from 'vitest';
import type {
  Cost,
  Planet,
  ResearchQueue,
  Universe,
} from '../../core/types.ts';
import { planet, U } from '../../test/fixtures.ts';
import type { Ui, V } from '../views/common.ts';
import {
  canOfferDemolition,
  completion,
  DEMOLITION_NOTE,
  demolitionActs,
  demolitionDialog,
  demolitionRoundChoice,
  demolitionRoundInputs,
  finishedLabel,
  refundSentence,
} from './demolition.ts';
import { roundReset } from './round-reset.ts';
import type { GameState } from './types.ts';

const NONE: Cost = [0, 0, 0];

function view(
  P: Partial<Planet> = {},
  cfg: Partial<Universe> = {},
  rq: ResearchQueue | null = null,
): V {
  return {
    s: { cfg: { ...U, ...cfg } } as unknown as GameState,
    P: planet({ res: { m: 500, c: 500, d: 0 }, ...P }),
    R: { research: {}, rq },
    now: 0,
    ui: {} as Ui,
  };
}

describe('the button „Zurückbauen“ (#202)', () => {
  it('stands on a planet at a building with a level while the queue is free', () => {
    expect(canOfferDemolition(view({ b: { metal: 1 } }), 'metal')).toBe(true);
    expect(canOfferDemolition(view({ b: {} }), 'metal')).toBe(false);
    expect(
      canOfferDemolition(
        view({ kind: 'moon', b: { moonbase: 1 } }),
        'moonbase',
      ),
    ).toBe(false);
    const bq = { key: 'crystal', lvl: 1, start: 0, end: 9, cost: NONE };
    expect(canOfferDemolition(view({ b: { metal: 1 }, bq }), 'metal')).toBe(
      false,
    );
  });

  it('stands also when the confirmation names a refusal', () => {
    const sq = [{ key: 'lc', n: 1, unit: 10 }];
    expect(canOfferDemolition(view({ b: { yard: 1 }, sq }), 'yard')).toBe(true);
    expect(
      canOfferDemolition(
        view(
          { b: { metal: 1 }, res: { m: 0, c: 0, d: 0 } },
          {
            roundDemolitionRefund: -100,
          },
        ),
        'metal',
      ),
    ).toBe(true);
  });
});

describe('the sentences of the owner (2026-11-17)', () => {
  const cost: Cost = [8000, 4000, 2001];

  it('name what comes back with a positive factor', () => {
    expect(refundSentence(cost, 50)).toBe(
      'Du erhältst 4.000 Adamant, 2.000 Psikristall, 1.000 Promethium zurück (Erstattung 50 %).',
    );
    expect(refundSentence(cost, 100)).toBe(
      'Du erhältst 8.000 Adamant, 4.000 Psikristall, 2.001 Promethium zurück (Erstattung 100 %).',
    );
  });

  it('name the cost with a negative factor', () => {
    expect(refundSentence(cost, -25)).toBe(
      'Der Rückbau kostet 2.000 Adamant, 1.000 Psikristall, 500 Promethium (Erstattung −25 %).',
    );
    expect(refundSentence(cost, -100)).toBe(
      'Der Rückbau kostet 8.000 Adamant, 4.000 Psikristall, 2.001 Promethium (Erstattung −100 %).',
    );
  });

  it('say nothing comes back at 0 %', () => {
    expect(refundSentence(cost, 0)).toBe('Du erhältst nichts zurück.');
  });
});

describe('the confirmation', () => {
  it('names the building, the new level, the refund and the time, with the button', () => {
    // Metal level 2 costs 90 / 22 and builds in 32,400 ms; 50 % of it.
    const html = demolitionDialog(view({ b: { metal: 2 } }), 'metal');
    expect(html).toContain(
      '<p><b>Adamant-Tiefbohrung</b>: Rückbau auf Stufe 1</p>',
    );
    expect(html).toContain(
      '<p>Du erhältst 45 Adamant, 11 Psikristall, 0 Promethium zurück (Erstattung 50 %).</p>',
    );
    expect(html).toContain('<p class="dim">Rückbau-Dauer: ');
    expect(html).toContain(
      '<button class="red" data-act="doDemolish" data-k="metal">Zurückbauen</button> <button data-act="closeModal">Abbrechen</button>',
    );
    expect(html).not.toContain('class="req"');
  });

  it('names a refusal instead of the button', () => {
    const sq = [{ key: 'lc', n: 1, unit: 10 }];
    const html = demolitionDialog(view({ b: { yard: 1 }, sq }), 'yard');
    expect(html).toContain(
      '<p class="req">Die Schiffsschmiede arbeitet gerade.</p><button data-act="closeModal">Abbrechen</button>',
    );
    expect(html).not.toContain('doDemolish');
    const poor = demolitionDialog(
      view(
        { b: { metal: 1 }, res: { m: 0, c: 0, d: 0 } },
        {
          roundDemolitionRefund: -100,
        },
      ),
      'metal',
    );
    expect(poor).toContain(
      'Der Rückbau kostet 60 Adamant, 15 Psikristall, 0 Promethium (Erstattung −100 %).',
    );
    expect(poor).toContain('<p class="req">Der Zehnte reicht nicht aus.</p>');
  });

  it('has the words of the server for every refusal', () => {
    expect(Object.keys(DEMOLITION_NOTE)).toEqual([
      'place',
      'none',
      'fields',
      'busy',
      'yardBusy',
      'labBusy',
      'cost',
    ]);
  });

  it('opens with „Zurückbauen“ and sends the order with its button', async () => {
    const act = vi.fn(() => Promise.resolve(true));
    const modal = vi.fn();
    const v = view({ b: { metal: 1 } });
    const acts = demolitionActs({ act, modal, view: () => v });
    acts.demolish!({ k: 'metal' });
    expect(modal).toHaveBeenCalledWith(demolitionDialog(v, 'metal'));
    await acts.doDemolish!({ k: 'metal' });
    expect(modal).toHaveBeenLastCalledWith('');
    expect(act).toHaveBeenCalledWith('demolish', { key: 'metal' });
    modal.mockClear();
    demolitionActs({ act, modal, view: () => null }).demolish!({ k: 'metal' });
    acts.demolish!({});
    expect(modal).not.toHaveBeenCalled();
  });
});

describe('the mark of a finished order', () => {
  const up = { key: 'metal', lvl: 3, start: 0, end: 10, cost: NONE };
  const down = { ...up, lvl: 1, back: NONE };

  it('is „Rückbau fertig“ for a demolition once the level went down', () => {
    expect(finishedLabel(down, 1, 10, 'Ausbau fertig')).toBe('Rückbau fertig');
    expect(finishedLabel(down, 0, 10, 'Ausbau fertig')).toBe('Rückbau fertig');
    expect(finishedLabel(down, 2, 10, 'Ausbau fertig')).toBeNull();
    expect(finishedLabel(down, 1, 9, 'Ausbau fertig')).toBeNull();
  });

  it('is the label of an upgrade once the level went up', () => {
    expect(finishedLabel(up, 3, 10, 'Ausbau fertig')).toBe('Ausbau fertig');
    expect(finishedLabel(up, 4, 11, 'Forschung fertig')).toBe(
      'Forschung fertig',
    );
    expect(finishedLabel(up, 2, 10, 'Ausbau fertig')).toBeNull();
    expect(finishedLabel(up, 3, 9, 'Ausbau fertig')).toBeNull();
    expect(finishedLabel(null, 3, 10, 'Ausbau fertig')).toBeNull();
  });

  it('names the building and its level in the notice', () => {
    expect(completion(down, { metal: 1 }, 10, 'Ausbau fertig')).toEqual({
      label: 'Rückbau fertig',
      notice: 'Rückbau fertig: Adamant-Tiefbohrung (Stufe 1).',
    });
    expect(completion(up, { metal: 3 }, 10, 'Ausbau fertig')).toEqual({
      label: 'Ausbau fertig',
      notice: 'Ausbau fertig: Adamant-Tiefbohrung (Stufe 3).',
    });
    expect(completion(up, {}, 10, 'Ausbau fertig')).toBeNull();
    expect(completion(null, {}, 10, 'Ausbau fertig')).toBeNull();
  });
});

describe('the settings of „Neue Runde“ (X1)', () => {
  it('are two inputs named as in the universe settings, preselected with the round', () => {
    expect(demolitionRoundInputs({ refund: -30, time: 120 })).toBe(
      '<p><label for="round-demolition-refund">Rückbau-Erstattung (%)</label> <input type="number" id="round-demolition-refund" min="-100" max="100" step="1" value="-30" required> <span class="dim">-100 bis 100</span></p>' +
        '<p><label for="round-demolition-time">Rückbau-Dauer (% der Bauzeit)</label> <input type="number" id="round-demolition-time" min="1" max="200" step="1" value="120" required> <span class="dim">1 bis 200</span></p>',
    );
  });

  it('are sent as numbers, an empty field as none', () => {
    const fields: Record<string, string> = {
      '#round-demolition-refund': '-20',
      '#round-demolition-time': ' ',
    };
    expect(demolitionRoundChoice((sel) => fields[sel] ?? '')).toEqual({
      refund: -20,
      time: null,
    });
  });

  it('go with every choice of the dialog', () => {
    const fields: Record<string, string> = {
      '#round-main-lock': '9',
      '#round-demolition-refund': '0',
      '#round-demolition-time': '75',
    };
    const boxes: Record<string, boolean> = {
      '#round-achievements': true,
      '#round-daily': false,
      '#round-guilds': true,
    };
    expect(
      roundReset(
        (sel) => fields[sel] ?? '',
        (sel) => boxes[sel] ?? false,
      ),
    ).toEqual({
      rewards: { achievements: true, daily: false },
      guilds: true,
      mainLock: 9,
      demolition: { refund: 0, time: 75 },
    });
  });
});
