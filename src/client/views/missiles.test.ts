// The dialog of the Raketenangriff (#54): the count up to the Orbitalraketen
// on the planet, the main target and the target in the button's data.
import { describe, expect, it } from 'vitest';
import type { Planet } from '../../core/types.ts';
import type { GalaxyPlanet } from '../logic/types.ts';
import type { V } from './common.ts';
import { missileForm, tearDownDialog } from './missiles.ts';

const v = {
  P: { def: { ipm: 1200, abm: 3 } } as unknown as Planet,
} as unknown as V;

const beta: GalaxyPlanet = {
  id: 'm1_3_6',
  kind: 'moon',
  name: '<b>Beta</b>',
  temp: 20,
  owner: 'u_Bert',
  g: 1,
  s: 3,
  p: 6,
};

describe('the dialog of the Raketenangriff (#54)', () => {
  it('asks for the count and the main target and starts at the target', () => {
    const html = missileForm(v, beta);
    expect(html).toContain(
      '<b>Raketenangriff auf &lt;b&gt;Beta&lt;/b&gt; (Mond) [1:3:6]</b>',
    );
    expect(html).toContain(
      '<label>Anzahl <input type="number" id="mi_n" min="1" max="1200" value="1200"></label> <span class="dim">(max 1.200)</span>',
    );
    expect(html).toContain(
      '<select id="mi_aim"><option value="">Kein Hauptziel</option><option value="rl">Raketenbatterie</option>',
    );
    expect(html).toContain(
      '<button data-act="doMissile" data-g="1" data-s="3" data-p="6" data-k="moon">Starten</button> <button data-act="closeModal">Abbrechen</button>',
    );
  });
});

describe('the confirmation of „Verschrotten“ (#54, 2026-11-21)', () => {
  it('names the missile and the amount, says nothing comes back and sends the amount', () => {
    const html = tearDownDialog('abm', 1200);
    expect(html).toContain('<b>Abfangrakete</b>: 1.200 verschrotten');
    expect(html).toContain(
      'Die Raketen sind sofort weg, ihre Plätze in der Raketenkrypta werden frei. Du erhältst nichts zurück.',
    );
    expect(html).toContain(
      '<button class="red" data-act="doTearDown" data-k="abm" data-n="1200">Verschrotten</button> <button data-act="closeModal">Abbrechen</button>',
    );
  });
});
