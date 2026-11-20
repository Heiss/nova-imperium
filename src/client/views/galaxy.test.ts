// The Sternenkarte shows every player a Trümmerfeld with its symbol, the
// tooltip and the button „Bergung“ (#45, owner, 2026-11-13). The component
// Galaxy (#118, bundle 2) renders it from galaxyPage(), on the server side
// of Svelte, as text without Svelte's comments.
import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import type { DebrisField } from '../../core/debris.ts';
import type { Planet } from '../../core/types.ts';
import { galaxyPage } from '../logic/galaxy.ts';
import type { GameState } from '../logic/types.ts';
import { stripComments } from '../../test/markup.ts';
import type { V } from './common.ts';
import Galaxy from './Galaxy.svelte';

/** The Sternenkarte of the view state, without Svelte's comments. */
const galaxy = (v: V): string =>
  stripComments(render(Galaxy, { props: { page: galaxyPage(v) } }).body);

const home = {
  id: 'p1_2_5',
  owner: 'u_Anna',
  g: 1,
  s: 2,
  p: 5,
  ships: {},
  def: {},
} as unknown as Planet;

function view(debris: DebrisField[], ships: Planet['ships'] = {}): V {
  const s = {
    cfg: { galaxies: 2, systems: 50, positions: 15 },
    me: { id: 'u_Anna', probes: 1 },
    players: {
      u_Anna: { name: 'Anna', points: 100 },
      u_Bert: { name: 'Bert', points: 100 },
    },
    galaxy: [
      {
        id: 'p1_2_5',
        name: 'Heimat',
        g: 1,
        s: 2,
        p: 5,
        kind: 'planet',
        temp: 20,
        owner: 'u_Anna',
      },
      {
        id: 'p1_2_6',
        name: 'Beta',
        g: 1,
        s: 2,
        p: 6,
        kind: 'planet',
        temp: 20,
        owner: 'u_Bert',
      },
    ],
    debris,
  } as unknown as GameState;
  return {
    s,
    P: { ...home, ships },
    R: { research: {}, rq: null },
    now: 0,
    ui: { gal: 1, sys: 2 },
  } as unknown as V;
}

/** The row of a position. */
const row = (html: string, p: number): string =>
  html.split('<tr').find((r) => r.includes(`<td class="n">${p}</td>`))!;

const field = (p: number, m: number, c: number): DebrisField => ({
  id: `d1_2_${p}`,
  g: 1,
  s: 2,
  p,
  m,
  c,
});

describe('Trümmerfelder on the Sternenkarte (#45)', () => {
  it('shows the symbol with its tooltip and the button at a foreign planet', () => {
    const html = galaxy(view([field(6, 1800, 600)]));
    const r = row(html, 6);
    expect(r).toContain('title="Trümmerfeld: 1.800 Adamant, 600 Psikristall"');
    expect(r).toContain('src="/icons/debris.svg"');
    expect(r).toContain('data-m="harvest"');
    expect(r).toContain('>Bergung</button>');
    expect(r).toContain('data-m="attack"');
  });

  it('shows them at the own planet and at a free position too', () => {
    const html = galaxy(view([field(5, 10, 20), field(9, 0, 300)]));
    for (const p of [5, 9]) {
      expect(row(html, p), String(p)).toContain('class="debris"');
      expect(row(html, p), String(p)).toContain('data-m="harvest"');
      expect(row(html, p), String(p)).toContain(`data-p="${p}"`);
    }
    expect(row(html, 9)).toContain(
      'title="Trümmerfeld: 0 Adamant, 300 Psikristall"',
    );
  });

  it('keeps the Landnahme beside the Bergung at a free position', () => {
    const html = galaxy(view([field(9, 0, 300)], { colony: 1 }));
    expect(row(html, 9)).toMatch(/Landnahme<\/button> · <button[^>]*>Bergung/);
    expect(row(html, 10)).toContain('Landnahme');
    expect(row(html, 10)).not.toContain('Bergung');
  });

  it('says until when a given-up position is locked and offers no Landnahme there (#224)', () => {
    const v = view([field(9, 0, 300)], { colony: 1 });
    const until = Date.UTC(2026, 10, 18, 12, 0);
    v.s.locks = [
      { g: 1, s: 2, p: 9, until },
      { g: 1, s: 2, p: 11, until: 5 },
    ];
    v.now = 10;
    const html = galaxy(v);
    expect(row(html, 9)).toMatch(
      /<span class="dim">gesperrt bis \d\d\.\d\d\.2026, \d\d:\d\d<\/span>/,
    );
    expect(row(html, 9)).not.toContain('Landnahme');
    // The Bergung stays; an ended lock and other positions are free as before.
    expect(row(html, 9)).toContain('Bergung');
    for (const p of [10, 11]) {
      expect(row(html, p)).toContain('<span class="dim">–</span>');
      expect(row(html, p)).toContain('Landnahme');
    }
  });

  it('shows neither symbol nor button without a field', () => {
    const html = galaxy(view([]));
    expect(html).not.toContain('debris');
    expect(html).not.toContain('Bergung');
    expect(galaxy(view([field(6, 1, 1)]))).not.toMatch(
      /data-p="(5|7|9)"[^>]*>Bergung/,
    );
  });
});

describe('moons on the Sternenkarte (#53)', () => {
  const moon = (p: number, owner: string, name = 'Mond') => ({
    id: `m1_2_${p}`,
    kind: 'moon',
    name,
    g: 1,
    s: 2,
    p,
    temp: 20,
    owner,
  });

  /** The Sternenkarte with moons at the planets, one of them opened. */
  function withMoons(open: string | null, active = 'p1_2_5'): string {
    const v = view([]);
    v.s.galaxy.push(
      moon(5, 'u_Anna', 'Luna') as never,
      moon(6, 'u_Bert') as never,
    );
    v.ui.gmoon = open;
    v.P = { ...v.P, id: active };
    return galaxy(v);
  }

  /** The rows of the table, split at each row. */
  const rows = (html: string): string[] => html.split('<tr').slice(1);

  it('shows the symbol at the planet for every player, closed', () => {
    const html = withMoons(null);
    expect(row(html, 5)).toContain('data-act="gmoon" data-id="m1_2_5"');
    expect(row(html, 5)).toContain('alt="Luna (Mond)"');
    expect(row(html, 6)).toContain('data-id="m1_2_6" aria-expanded="false"');
    expect(row(html, 7)).not.toContain('gmoon');
    expect(html).not.toContain('moon-row');
    // A row per position, the row of the expedition position (#93) and the header.
    expect(rows(html)).toHaveLength(17);
  });

  it('opens the actions of a foreign moon below its planet', () => {
    const html = withMoons('m1_2_6');
    const all = rows(html);
    const at = all.findIndex((r) => r.includes('<td class="n">6</td>'));
    const moonRow = all[at + 1]!;
    expect(row(html, 6)).toContain('aria-expanded="true"');
    expect(moonRow).toContain('class="moon-row "');
    expect(moonRow).toContain('Mond (Mond)');
    expect(moonRow).toContain('Bert');
    expect(moonRow).toContain(
      'data-act="gspy" data-g="1" data-s="2" data-p="6" data-k="moon">Auspex-Erkundung',
    );
    expect(moonRow).toContain(
      'data-act="gfleet" data-m="attack" data-g="1" data-s="2" data-p="6" data-k="moon">Sturmangriff',
    );
    expect(moonRow).toContain('data-m="transport"');
    expect(moonRow).not.toContain('data-m="deploy"');
    expect(rows(html)).toHaveLength(18);
    // The planet keeps its own actions, without the moon.
    expect(row(html, 6)).not.toContain('data-k="moon"');
  });

  it('opens the actions of an own moon: switch, supply and Verlegung', () => {
    const html = withMoons('m1_2_5');
    const all = rows(html);
    const moonRow =
      all[all.findIndex((r) => r.includes('<td class="n">5</td>')) + 1]!;
    expect(moonRow).toContain('class="moon-row me"');
    expect(moonRow).toContain('Luna (Mond)');
    expect(moonRow).toContain('data-act="selectPlanet" data-id="m1_2_5"');
    expect(moonRow).toContain('data-m="transport"');
    expect(moonRow).toContain('data-m="deploy"');
    expect(moonRow).toContain('data-k="moon"');
    expect(moonRow).not.toContain('Sturmangriff');
  });

  it('names the active moon', () => {
    const html = withMoons('m1_2_5', 'm1_2_5');
    expect(html).toContain('<span class="dim">Aktiver Mond</span>');
    expect(html).not.toContain('Aktiver Planet');
    expect(withMoons(null)).toContain(
      '<span class="dim">Aktiver Planet</span>',
    );
  });
});

describe('the Auspex-Phalanx on the Sternenkarte (#53)', () => {
  /** The Sternenkarte from Anna's moon at [1:2:5] with a phalanx of `level`. */
  function fromMoon(level: number, scan: V['ui']['scan'] = null): V {
    const v = view([]);
    v.s.galaxy.push({
      id: 'm1_2_6',
      kind: 'moon',
      name: 'Mond',
      g: 1,
      s: 2,
      p: 6,
      temp: 20,
      owner: 'u_Bert',
    });
    v.P = {
      ...v.P,
      id: 'm1_2_5',
      kind: 'moon',
      owner: 'u_Anna',
      b: { moonbase: 1, phalanx: level },
    };
    v.ui.gmoon = 'm1_2_6';
    v.ui.scan = scan;
    return v;
  }

  const SCAN_BUTTON =
    '<button class="small" data-act="gscan" data-id="p1_2_6" aria-label="Phalanx-Scan von Beta">Phalanx-Scan</button>';

  it('offers the scan at a foreign planet in range, from a moon with a phalanx', () => {
    const html = galaxy(fromMoon(1));
    expect(row(html, 6)).toContain(SCAN_BUTTON);
    expect(row(html, 6)).toMatch(
      /Versorgungsflug<\/span> · <button[^>]*>Phalanx-Scan/,
    );
    // Not at the own planet, not at a moon.
    expect(row(html, 5)).not.toContain('gscan');
    expect(html.match(/data-act="gscan"/g)).toHaveLength(1);
  });

  it('offers no scan without a phalanx or from a planet', () => {
    expect(galaxy(fromMoon(0))).not.toContain('gscan');
    expect(galaxy(view([]))).not.toContain('gscan');
  });

  it('offers no scan of a planet out of range, while it shows the planet', () => {
    // The scanning moon in system `s` of galaxy 1 with a phalanx of level 2:
    // a range of 2² − 1 = 3 systems; the Sternenkarte still shows [1:2:6].
    const from = (s: number): string => {
      const v = fromMoon(2);
      v.P = { ...v.P, id: `m1_${s}_5`, s };
      return row(galaxy(v), 6);
    };
    // Four systems away: the row of Beta is there, without the scan.
    const far = from(6);
    expect(far).toContain('Beta');
    expect(far).toContain('data-m="attack"');
    expect(far).not.toContain('gscan');
    // Three systems away, at the edge of the range: the scan is offered.
    expect(from(5)).toContain(SCAN_BUTTON);
  });

  it('shows no panel before a scan, or after it from another place', () => {
    expect(galaxy(fromMoon(1))).not.toContain('scan-panel');
    const other = fromMoon(1, { by: 'm9_9_9', target: 'p1_2_6', flights: [] });
    expect(galaxy(other)).not.toContain('scan-panel');
  });

  it('shows the flights of the scan in a panel: ships, origin, target and arrival', () => {
    const v = fromMoon(1, {
      by: 'm1_2_5',
      target: 'p1_2_6',
      flights: [
        { ships: { lc: 10 }, from: 'p1_2_9', to: 'p1_2_6', arr: 65_000 },
        { ships: { probe: 2 }, from: 'p1_2_6', to: 'm1_2_9', arr: 90_000 },
      ],
    });
    const html = galaxy(v);
    const panel = html.slice(
      html.indexOf('<section'),
      html.indexOf('</section>'),
    );
    expect(panel).toContain('aria-labelledby="scan-h"');
    expect(panel).toContain(
      '<h3 id="scan-h" tabindex="-1">Phalanx-Scan: Beta [1:2:6]</h3>',
    );
    expect(panel).toContain(
      '<tr><th>Schiffe</th><th>Herkunft</th><th>Ziel</th><th>Ankunft</th></tr>',
    );
    expect(panel).toContain(
      `<tr><td>10 Lastbarke</td><td>[1:2:9]</td><td>[1:2:6]</td><td><span class="cd" data-end="65000">1m 05s</span></td></tr>`,
    );
    expect(panel).toContain('<td>[1:2:9] (Mond)</td>');
    expect(panel).toContain('data-act="gscanClose">Schließen</button>');
    // Before the table of the systems.
    expect(html.indexOf('scan-panel')).toBeLessThan(
      html.indexOf('class="gal"'),
    );
  });

  it('shows an empty scan as such', () => {
    const v = fromMoon(1, { by: 'm1_2_5', target: 'p1_2_6', flights: [] });
    const html = galaxy(v);
    expect(html).toContain('<p class="dim">Keine Flüge erfasst.</p>');
    expect(html).not.toContain('class="scan"');
  });

  it('escapes the name of the planet', () => {
    const v = fromMoon(1, { by: 'm1_2_5', target: 'p1_2_6', flights: [] });
    v.s.galaxy[1] = { ...v.s.galaxy[1]!, name: '<b>"x"' };
    const html = galaxy(v);
    // Svelte escapes < and & in the text, and " too in an attribute.
    expect(html).toContain('Phalanx-Scan: &lt;b>"x" [1:2:6]');
    expect(html).toContain('aria-label="Phalanx-Scan von &lt;b>&quot;x&quot;"');
    expect(html).not.toContain('<b>');
  });
});

describe('the vacation mode on the Sternenkarte (#223)', () => {
  it('marks the owner of a planet in vacation mode with (u)', () => {
    const v = view([]);
    v.s.players.u_Bert = { name: 'Bert', points: 100, vacation: true };
    const html = galaxy(v);
    expect(row(html, 6)).toContain(
      'Bert <span class="dim">(Platz 2)</span> <span class="dim" title="Urlaubsmodus">(u)</span></td>',
    );
    expect(row(html, 5)).not.toContain('(u)');
  });
});

describe('the Raketenangriff on the Sternenkarte (#54)', () => {
  /** Anna's planet with `ipm` Orbitalraketen and the impulse drive at `impulse`. */
  function armed(ipm: number, impulse = 1, s = 2): V {
    const v = view([]);
    v.P = { ...v.P, s, def: { ipm, abm: 3 } };
    v.R = { research: { impulse }, rq: null };
    return v;
  }

  const BUTTON =
    '<button class="small" data-act="gmissile" data-id="p1_2_6" data-g="1" data-s="2" data-p="6" aria-label="Raketenangriff auf Beta">Raketenangriff</button>';

  it('offers it at a foreign planet in range, from a planet with Orbitalraketen', () => {
    const html = galaxy(armed(3));
    expect(row(html, 6)).toContain(BUTTON);
    expect(row(html, 5)).not.toContain('gmissile');
    expect(html.match(/data-act="gmissile"/g)).toHaveLength(1);
  });

  it('offers it at a foreign moon, with its kind', () => {
    const v = armed(1);
    v.s.galaxy.push({
      id: 'm1_2_6',
      kind: 'moon',
      name: 'Mond',
      g: 1,
      s: 2,
      p: 6,
      temp: 20,
      owner: 'u_Bert',
    });
    v.ui.gmoon = 'm1_2_6';
    expect(galaxy(v)).toContain(
      'data-act="gmissile" data-id="m1_2_6" data-g="1" data-s="2" data-p="6" data-k="moon" aria-label="Raketenangriff auf Mond (Mond)"',
    );
  });

  it('offers it neither without Orbitalraketen nor out of range', () => {
    expect(galaxy(armed(0))).not.toContain('gmissile');
    expect(galaxy(armed(3, 0))).not.toContain('gmissile');
    // Impulse 1 reaches 4 systems: from system 6 yes, from system 7 no.
    expect(row(galaxy(armed(3, 1, 6)), 6)).toContain('gmissile');
    expect(row(galaxy(armed(3, 1, 7)), 6)).not.toContain('gmissile');
  });
});

describe('activity and inactivity on the Sternenkarte (#229)', () => {
  /** The Sternenkarte with Bert's planet and moon active and Bert's account in `inactive`. */
  function marked(inactive?: 'inactive' | 'long'): V {
    const v = view([]);
    v.s.galaxy[1]!.activity = { minutes: 42 };
    v.s.galaxy.push({
      id: 'm1_2_6',
      kind: 'moon',
      name: 'Mond',
      g: 1,
      s: 2,
      p: 6,
      temp: 20,
      owner: 'u_Bert',
      activity: { recent: true },
    });
    v.s.players.u_Bert!.inactive = inactive;
    return v;
  }

  it('shows the activity of a planet after its name, the moon’s in its row', () => {
    const v = marked();
    v.ui.gmoon = 'm1_2_6';
    const html = galaxy(v);
    expect(row(html, 6)).toContain(
      'Beta <span class="dim">(Aktivität vor 42 Minuten)</span>',
    );
    expect(html).toContain('Mond (Mond) <span class="dim">(Aktiv)</span>');
    // Anna's planet shows no activity.
    expect(row(html, 5)).not.toContain('Aktivität');
  });

  it('shows the inactivity of an account after the player, apart from the noob protection', () => {
    expect(row(galaxy(marked()), 6)).not.toContain('inaktiv');
    expect(row(galaxy(marked('inactive')), 6)).toContain(
      'Bert <span class="dim">(Platz 2)</span> <span class="dim">(Inaktiv)</span>',
    );
    expect(row(galaxy(marked('long')), 6)).toContain(
      '<span class="dim">(Lange inaktiv)</span>',
    );
  });
});

describe('the actions of a position behind „⋯“ on a phone (#189)', () => {
  it('puts a „⋯“ after the actions of a row, which the CSS shows on a phone only', () => {
    const r = row(galaxy(view([])), 6);
    expect(r).toContain('<td class="has-sheet"><span class="gal-acts">');
    expect(r).toContain(
      '<button type="button" class="small more phone-only" id="gsheet-p1_2_6" data-act="gsheet" data-id="p1_2_6" aria-haspopup="dialog" aria-label="Aktionen für Beta [1:2:6]">⋯</button>',
    );
    // The shown planet has only its name, and a free position nothing.
    expect(row(galaxy(view([])), 5)).not.toContain('gsheet');
    expect(row(galaxy(view([])), 9)).not.toContain('gsheet');
  });

  it('renders no sheet while none is open', () => {
    expect(galaxy(view([]))).not.toContain('<dialog');
  });

  it('renders the open sheet as a dialog with the title, the flight time, the actions and „Schließen“', () => {
    const v = view([field(6, 1800, 600)], { lc: 2 });
    v.ui.gsheet = 'p1_2_6';
    const html = galaxy(v);
    expect(html).toContain('<dialog');
    expect(html).toContain('aria-labelledby="gsheet-title"');
    expect(html).toContain(
      '<p id="gsheet-title" class="sheet-title">Beta [1:2:6]</p>',
    );
    expect(html).toContain('Flugzeit mit allen Schiffen: ');
    const sheet = html.slice(html.indexOf('<dialog'));
    // Every action of the row is a button of the sheet, with its data-act.
    for (const label of ['Auspex-Erkundung', 'Sturmangriff', 'Versorgungsflug'])
      expect(sheet).toMatch(
        new RegExp(`<button[^>]*data-act="[^"]+"[^>]*>${label}</button>`),
      );
    expect(sheet).toContain('>Bergung</button>');
    expect(sheet).toContain('class="sheet-close">Schließen</button>');
  });

  it('shows no flight time without a ship that flies', () => {
    const v = view([]);
    v.ui.gsheet = 'p1_2_6';
    expect(galaxy(v)).not.toContain('Flugzeit');
  });
});
