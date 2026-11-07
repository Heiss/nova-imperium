// The browser glue: state, server calls, rendering, events and the clock.
// The views are pure functions (views/), the logic is tested (logic/); this
// file is run by the E2E suite.
import { BUILD, RES, UNIT } from '../shared/catalog.ts';
import { pid } from '../shared/flight.ts';
import { settle, settleR } from '../shared/settle.ts';
import type { Levels, Planet, Queue } from '../shared/types.ts';
import { clampInt, coords, dt, dur, esc, fmt } from './logic/format.ts';
import {
  cargoMax,
  fleetPreview,
  galaxyStep,
  nameOf,
  planetColors,
  settingsFrom,
  unread,
  type FleetForm,
} from './logic/game.ts';
import type { GameState } from './logic/types.ts';
import { afford, caps, lvlCost, maxAfford, prod } from '../shared/economy.ts';
import type { Ui, V } from './views/common.ts';
import { menu, VIEWS } from './views/index.ts';
import { auth } from './views/misc.ts';
import { mountBuildings } from './views/buildings.ts';

type Data = Record<string, string | undefined>;

const $ = <T extends HTMLElement = HTMLElement>(sel: string): T | null =>
  document.querySelector<T>(sel);
const val = (sel: string): string => $<HTMLInputElement>(sel)?.value ?? '';

let S: GameState | null = null;
let offset = 0;
let lastKey = '';
let ctx: V | null = null;
let buildingView: ReturnType<typeof mountBuildings> | null = null;
const completionNotices = new Set<string>();

function gameView(view: string | null): string {
  if (!view || (view !== 'buildings' && !Object.hasOwn(VIEWS, view)))
    return 'overview';
  return view === 'admin' && S && !S.me.admin ? 'overview' : view;
}

const viewFromUrl = (): string =>
  gameView(new URLSearchParams(location.search).get('view'));

function viewUrl(view: string): string {
  const url = new URL(location.href);
  url.searchParams.set('view', view);
  url.hash = '';
  return url.pathname + url.search;
}

const ui: Ui = {
  view: viewFromUrl(),
  gal: 1,
  sys: 1,
  ft: null,
  fm: 'attack',
  openRep: {},
  auth: null,
  invite: null,
  lastLink: null,
};

const nowT = (): number => Date.now() + offset;

// ----- messages -----

function toast(msg: string, err = false): void {
  const t = document.createElement('div');
  t.className = 'toast' + (err ? ' err' : '');
  t.setAttribute('role', err ? 'alert' : 'status');
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

function modal(html: string): void {
  const m = $('#modal')!;
  $('#modalIn')!.innerHTML = html;
  m.classList.toggle('show', html !== '');
}

// ----- server -----

class AuthError extends Error {}

async function api(
  url: string,
  body?: unknown,
): Promise<Record<string, unknown>> {
  const r = await fetch(url, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'content-type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  });
  const j = (await r
    .json()
    .catch(() => ({ error: 'Keine Antwort vom Server.' }))) as Record<
    string,
    unknown
  >;
  if (r.status === 401) {
    S = null;
    ui.auth ??= 'login';
    render(true);
    throw new AuthError(String(j.error ?? 'Bitte einloggen.'));
  }
  if (!r.ok) throw new Error(String(j.error ?? 'Fehler'));
  return j;
}

function apply(st: GameState | undefined): void {
  if (!st) return;
  const key = JSON.stringify({ ...st, now: 0 });
  const same = key === lastKey;
  lastKey = key;
  offset = st.now - Date.now();
  S = st;
  const view = gameView(ui.view);
  if (view !== ui.view) {
    ui.view = view;
    history.replaceState(null, '', viewUrl(view));
  }
  $('#unisub')!.textContent = `Classic Universum · Speed x${st.cfg.speed}`;
  if (!same) render();
}

async function refresh(): Promise<void> {
  try {
    apply((await api('/api/state')) as unknown as GameState);
  } catch (e) {
    if (S) console.warn(e);
  }
}

async function act(type: string, data: object = {}): Promise<boolean> {
  try {
    const j = await api('/api/action', { type, ...data });
    apply(j.state as GameState);
    if (j.msg) toast(String(j.msg));
    return true;
  } catch (e) {
    toast((e as Error).message, true);
    return false;
  }
}

// ----- rendering -----

/** Paints planets from data-temp (CSSOM is allowed by the CSP, style="" is not). */
function paintPlanets(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>('[data-temp]').forEach((el) => {
    const c = planetColors(Number(el.dataset.temp));
    el.style.background = `radial-gradient(circle at 35% 35%, ${c.inner}, ${c.outer})`;
  });
}

function keepInputs(view: HTMLElement, fresh: boolean): () => void {
  const saved: Record<string, string> = {};
  const focus = document.activeElement?.id;
  if (!fresh)
    view
      .querySelectorAll<HTMLInputElement>('input[id],select[id]')
      .forEach((i) => (saved[i.id] = i.value));
  return () => {
    for (const [id, v] of Object.entries(saved)) {
      const el = document.getElementById(id) as HTMLInputElement | null;
      if (el && !el.hasAttribute('data-nokeep')) el.value = v;
    }
    if (focus) document.getElementById(focus)?.focus();
  };
}

function renderLoggedOut(view: HTMLElement): void {
  ctx = null;
  unmountBuildings();
  completionNotices.clear();
  $('#menu')!.innerHTML = '';
  $('#resbar')!.innerHTML = '';
  $('#pinfo')!.innerHTML = '';
  view.innerHTML = ui.auth ? auth(ui) : '<div class="notice">Lade …</div>';
}

function rememberUpgrade(
  order: Queue | null,
  levels: Levels,
  catalog: Record<string, { n: string }>,
  label: string,
  now: number,
): void {
  if (!order || order.end > now || (levels[order.key] ?? 0) < order.lvl) return;
  const name = catalog[order.key]?.n ?? order.key;
  completionNotices.add(`${label}: ${name} (Stufe ${order.lvl}).`);
}

function rememberCompletions(previous: V, next: V): void {
  if (previous.P.id !== next.P.id) return;
  rememberUpgrade(previous.P.bq, next.P.b, BUILD, 'Ausbau fertig', next.now);
  rememberUpgrade(
    previous.R.rq,
    next.R.research,
    RES,
    'Forschung fertig',
    next.now,
  );
  const start = previous.P.sqT;
  if (start === null || !previous.P.sq.length || next.P.sq.length) return;
  const end = previous.P.sq.reduce((time, q) => time + q.n * q.unit, start);
  if (end <= next.now) completionNotices.add('Werftauftrag fertig.');
}

function renderCompletions(view: HTMLElement): void {
  view.querySelector('#completion-notice')?.remove();
  if (!completionNotices.size) return;
  const notice = document.createElement('div');
  notice.id = 'completion-notice';
  notice.className = 'notice';
  notice.setAttribute('role', 'status');
  notice.textContent = [...completionNotices].join(' ');
  view.prepend(notice);
}

function unmountBuildings(): void {
  buildingView?.destroy();
  buildingView = null;
}

function renderView(target: HTMLElement, view: V): void {
  if (ui.view === 'buildings') {
    if (buildingView) buildingView.update(view);
    else {
      target.replaceChildren();
      buildingView = mountBuildings(target, view);
    }
    return;
  }
  unmountBuildings();
  const show = Object.entries(VIEWS).find(([name]) => name === ui.view)?.[1];
  target.innerHTML = (show ?? VIEWS.overview!)(view);
}

function render(fresh = false): void {
  const view = $('#view')!;
  if (!S) return renderLoggedOut(view);
  if (!S.planet) {
    ctx = null;
    unmountBuildings();
    view.innerHTML =
      '<div class="notice">Du hast keinen Planeten. Bitte den Admin, eine neue Runde zu starten.</div>';
    return;
  }
  const restore = keepInputs(view, fresh);
  const now = nowT();
  const previous = ctx;
  ctx = {
    s: S,
    P: settle(S.planet, now, S.cfg),
    R: settleR(S.me, now),
    now,
    ui,
  };
  if (previous && !fresh) rememberCompletions(previous, ctx);
  renderMenu();
  updateBar();
  $('#pinfo')!.innerHTML =
    `<b>${esc(ctx.P.name)}</b> ${coords(ctx.P)} · Kommandant <b>${esc(S.me.name)}</b> · <span class="lnk" data-act="logout">Logout</span>`;
  renderView(view, ctx);
  renderCompletions(view);
  paintPlanets(view);
  restore();
  if (ui.view === 'fleet') fleetCalc();
  if (ui.view === 'messages') markRead();
}

function renderMenu(): void {
  const n = unread(S!.reports, S!.me.readAt || 0);
  $('#menu')!.innerHTML = menu(S!.me.admin)
    .map((i) => {
      if (i === '-') return '<div class="sep"></div>';
      const badge =
        i.view === 'messages' && n ? `<span class="badge">${n}</span>` : '';
      return `<a href="${esc(viewUrl(i.view))}" data-act="nav" data-v="${i.view}" class="${ui.view === i.view ? 'on' : ''}">${esc(i.label)}${badge}</a>`;
    })
    .join('');
}

function updateBar(): Planet | undefined {
  if (!S?.planet) return;
  const p = settle(S.planet, nowT(), S.cfg);
  const pr = prod(p, S.cfg);
  const cp = caps(p, S.cfg);
  const r = (
    label: string,
    cls: string,
    v: number,
    cap: number,
    per: number,
  ): string =>
    `<div class="res" title="+${fmt(per)}/h · Lager ${fmt(cap)}"><div class="l"><span class="gem gem-${cls}"></span>${label}</div><div class="v ${v >= cap ? 'full' : ''}">${fmt(v)}</div></div>`;
  $('#resbar')!.innerHTML =
    r('Metall', 'm', p.res.m, cp.m, pr.m) +
    r('Kristall', 'c', p.res.c, cp.c, pr.c) +
    r('Deuterium', 'd', p.res.d, cp.d, pr.d) +
    `<div class="res"><div class="l"><span class="gem gem-e"></span>Energie</div><div class="v ${pr.eProd - pr.eUse < 0 ? 'bad' : ''}">${fmt(pr.eProd - pr.eUse)}/${fmt(pr.eProd)}</div></div>`;
  return p;
}

function updateResearchButtons(p: Planet, research: Levels): void {
  document
    .querySelectorAll<HTMLButtonElement>('#view button[data-act="research"]')
    .forEach((button) => {
      const key = button.dataset.k!;
      const level = research[key] ?? 0;
      button.disabled = !afford(p, lvlCost(RES[key]!, level + 1));
    });
}

function updateShipyardButtons(p: Planet): void {
  document
    .querySelectorAll<HTMLElement>('#view [data-act="maxq"]')
    .forEach((max) => {
      const count = maxAfford(p, UNIT[max.dataset.k!]!.cost);
      if (max.dataset.max !== String(count)) {
        max.dataset.max = String(count);
        max.textContent = `(max ${fmt(count)})`;
      }
      const button = max
        .closest('.act')!
        .querySelector<HTMLButtonElement>('button')!;
      button.disabled = p.bq?.key === 'yard' || count === 0;
    });
}

let readPending = false;
function markRead(): void {
  const list = S!.reports;
  const newest = Math.max(0, ...list.map((r) => r.time));
  if (newest > (S!.me.readAt || 0) && !readPending) {
    readPending = true;
    setTimeout(
      () => void act('read').finally(() => (readPending = false)),
      600,
    );
  }
}

// ----- fleet form -----

function readFleetForm(): FleetForm {
  const ships: Record<string, number> = {};
  const P = ctx!.P;
  const u = S!.cfg;
  document.querySelectorAll<HTMLInputElement>('.fs').forEach((i) => {
    const k = i.dataset.k!;
    const n = clampInt(i.value, 0, P.ships[k] ?? 0);
    if (n > 0) ships[k] = n;
  });
  return {
    ships,
    to: {
      g: clampInt(val('#t_g'), 1, u.galaxies),
      s: clampInt(val('#t_s'), 1, u.systems),
      p: clampInt(val('#t_p'), 1, u.positions),
    },
    mission: val('#t_m'),
    pct: clampInt(val('#t_v'), 1, 10),
    cargo: {
      m: clampInt(val('#c_m'), 0, 1e15),
      c: clampInt(val('#c_c'), 0, 1e15),
      d: clampInt(val('#c_d'), 0, 1e15),
    },
  };
}

function fleetCalc(): void {
  if (!$('#t_g') || !ctx || !S) return;
  const f = readFleetForm();
  const target = S.galaxy.find((p) => p.id === pid(f.to));
  $('#t_info')!.innerHTML = target
    ? `${esc(target.name)} (${esc(nameOf(S.players, target.owner))})`
    : '<span class="bad">kein Planet</span>';
  const pv = fleetPreview(ctx.P, ctx.R, f, S.cfg);
  const set = (id: string, html: string): void =>
    void ($(`#${id}`)!.innerHTML = html);
  if (!pv)
    return ['i_dist', 'i_dur', 'i_arr', 'i_fuel', 'i_cap'].forEach((id) =>
      set(id, '-'),
    );
  const now = nowT();
  set('i_dist', fmt(pv.dist));
  set('i_dur', dur(pv.ms));
  set('i_arr', `${dt(now + pv.ms)} / ${dt(now + 2 * pv.ms)}`);
  set(
    'i_fuel',
    `<span class="${pv.fuelShort ? 'bad' : ''}">${fmt(pv.fuel)}</span> Deuterium`,
  );
  set(
    'i_cap',
    `<span class="${pv.overload ? 'bad' : ''}">${fmt(pv.load)}</span> / ${fmt(pv.cap)}`,
  );
}

const setInput = (sel: string, v: string | number): void => {
  const el = $<HTMLInputElement>(sel);
  if (el) el.value = String(v);
};

// ----- actions -----

const go = (requested: string, push = true): void => {
  const view = gameView(requested);
  if (view !== ui.view) {
    completionNotices.clear();
    if (push) history.pushState(null, '', viewUrl(view));
  }
  ui.view = view;
  render(true);
  window.scrollTo(0, 0);
};

const ACT: Record<string, (d: Data) => unknown> = {
  nav: (d) => go(d.v ?? 'overview'),
  logout: async () => {
    await api('/api/logout', {}).catch(() => null);
    S = null;
    ui.auth = 'login';
    render(true);
  },
  authswitch: () => {
    ui.auth = ui.auth === 'register' ? 'login' : 'register';
    render(true);
  },
  build: (d) => act('build', { key: d.k }),
  cancelBuild: () => act('cancelBuild'),
  research: (d) => act('research', { key: d.k }),
  cancelResearch: () => act('cancelResearch'),
  maxq: (d) => setInput(`#q_${d.k}`, d.max ?? 0),
  order: async (d) => {
    const n = clampInt(val(`#q_${d.k}`), 0, 1e9);
    if (!n) return toast('Bitte eine Anzahl eingeben.', true);
    if (await act('order', { key: d.k, n })) setInput(`#q_${d.k}`, '');
  },
  rename: () =>
    modal(
      `<p><b>Planet umbenennen</b></p><input id="rn" maxlength="20" value="${esc(ctx!.P.name)}" aria-label="Neuer Name"> <button data-act="doRename">OK</button> <button data-act="closeModal">Abbrechen</button>`,
    ),
  doRename: () => {
    const n = val('#rn').trim();
    modal('');
    if (n) void act('rename', { name: n });
  },
  closeModal: () => modal(''),
  gnav: (d) => {
    Object.assign(ui, galaxyStep(ui.gal, ui.sys, d.d ?? '', S!.cfg));
    render(true);
  },
  ggo: () => {
    ui.gal = clampInt(val('#g_g'), 1, S!.cfg.galaxies);
    ui.sys = clampInt(val('#g_s'), 1, S!.cfg.systems);
    render(true);
  },
  ghome: () => {
    ui.gal = ctx!.P.g;
    ui.sys = ctx!.P.s;
    render(true);
  },
  gto: (d) => {
    ui.gal = Number(d.g);
    ui.sys = Number(d.s);
    go('galaxy');
  },
  gfleet: (d) => {
    ui.ft = { g: Number(d.g), s: Number(d.s), p: Number(d.p) };
    ui.fm = d.m ?? 'attack';
    go('fleet');
  },
  gspy: (d) => {
    const n = Math.min(ctx!.P.ships.probe ?? 0, S!.me.probes || 1);
    if (!n) return toast('Keine Spionagesonden auf dem Planeten.', true);
    return act('send', {
      ships: { probe: n },
      to: { g: Number(d.g), s: Number(d.s), p: Number(d.p) },
      mission: 'spy',
      pct: 10,
      cargo: { m: 0, c: 0, d: 0 },
    });
  },
  fmax: (d) => {
    setInput(`#f_${d.k}`, ctx!.P.ships[d.k!] ?? 0);
    fleetCalc();
  },
  fall: () => {
    document
      .querySelectorAll<HTMLInputElement>('.fs')
      .forEach((i) => (i.value = String(ctx!.P.ships[i.dataset.k!] ?? 0)));
    fleetCalc();
  },
  fnone: () => {
    document
      .querySelectorAll<HTMLInputElement>('.fs')
      .forEach((i) => (i.value = ''));
    fleetCalc();
  },
  cmax: () => {
    const c = cargoMax(settle(S!.planet!, nowT(), S!.cfg), readFleetForm());
    setInput('#c_m', c.m);
    setInput('#c_c', c.c);
    setInput('#c_d', c.d);
    fleetCalc();
  },
  send: async () => {
    if (await act('send', readFleetForm())) {
      ui.ft = null;
      render(true);
    }
  },
  recall: (d) => act('recall', { id: d.id }),
  toggleRep: (d) => {
    ui.openRep[d.id!] = !ui.openRep[d.id!];
    document.getElementById(`rep_${d.id}`)?.classList.toggle('open');
  },
  delrep: (d) => act('delrep', { id: d.id }),
  delall: () => act('delall'),
  saveopt: () => act('options', { probes: clampInt(val('#o_probes'), 1, 1e6) }),
  reset: () =>
    modal(
      `<p><b>Wirklich eine neue Runde starten?</b><br>Alle Planeten, Flotten und Forschungen werden gelöscht. Das kann nicht rückgängig gemacht werden.</p><button class="red" data-act="doReset">Ja, neue Runde</button> <button data-act="closeModal">Abbrechen</button>`,
    ),
  doReset: () => {
    modal('');
    return act('reset');
  },
  saveSettings: () => {
    const keys = S!.admin!.specs.map((x) => x.key);
    return act('settings', {
      settings: settingsFrom(keys, (k) => val(`#set_${k}`)),
    });
  },
  revoke: (d) => adminCall('/api/admin/revoke', { id: d.id }),
  copyLink: async () => {
    const input = $<HTMLInputElement>('#inv_link');
    if (!input) return;
    input.select();
    try {
      await navigator.clipboard.writeText(input.value);
      toast('Link kopiert.');
    } catch {
      toast('Bitte den markierten Link selbst kopieren.', true);
    }
  },
};

async function adminCall(
  url: string,
  body: object,
): Promise<Record<string, unknown> | null> {
  try {
    const j = await api(url, body);
    apply(j.state as GameState);
    if (j.msg) toast(String(j.msg), j.mailed === false);
    return j;
  } catch (e) {
    toast((e as Error).message, true);
    return null;
  }
}

// ----- forms -----

async function submitAuth(): Promise<void> {
  const reg = ui.auth === 'register' && ui.invite;
  const body: Record<string, unknown> = {
    name: val('#a_name'),
    password: val('#a_pw'),
  };
  if (reg)
    Object.assign(body, {
      token: ui.invite!.token,
      planet: val('#a_planet'),
      gal: val('#a_gal'),
    });
  try {
    const j = await api(reg ? '/api/register' : '/api/login', body);
    ui.auth = null;
    ui.invite = null;
    apply(j.state as GameState);
    homeSystem();
    if (reg && S?.planet)
      toast(
        `Willkommen, ${S.me.name}! Dein Planet liegt bei ${coords(S.planet)}.`,
      );
    render(true);
  } catch (e) {
    toast((e as Error).message, true);
  }
}

async function submitInvite(): Promise<void> {
  const email = val('#inv_email').trim();
  const j = await adminCall('/api/admin/invite', { email });
  if (!j) return;
  ui.lastLink = String(j.link);
  render(true);
}

function homeSystem(): void {
  if (S?.planet) {
    ui.gal = S.planet.g;
    ui.sys = S.planet.s;
  }
}

// ----- events -----

document.addEventListener('click', (e) => {
  const el = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
  const fn = el ? ACT[el.dataset.act!] : undefined;
  if (!el || !fn) return;
  const modified = e.metaKey || e.ctrlKey || e.shiftKey || e.altKey;
  if (el.dataset.act === 'nav' && (modified || e.button !== 0)) return;
  e.preventDefault();
  void fn({ ...el.dataset });
});
document.addEventListener('change', (e) => {
  const el = e.target as HTMLSelectElement;
  if (el.dataset?.chg === 'pct')
    void act('pct', { key: el.dataset.k, v: el.value });
  if (ui.view === 'fleet') fleetCalc();
});
document.addEventListener('input', (e) => {
  if (ui.view === 'fleet' && (e.target as HTMLElement).closest('main'))
    fleetCalc();
});
document.addEventListener('keydown', (e) => {
  const id = (e.target as HTMLElement).id;
  if (e.key === 'Enter' && id?.startsWith('g_')) ACT.ggo!({});
  if (e.key === 'Escape') modal('');
});
document.addEventListener('submit', (e) => {
  const id = (e.target as HTMLElement).id;
  if (id !== 'authform' && id !== 'inviteform') return;
  e.preventDefault();
  void (id === 'authform' ? submitAuth() : submitInvite());
});
$('#modal')!.addEventListener('click', (e) => {
  if ((e.target as HTMLElement).id === 'modal') modal('');
});

// ----- clock -----

function queueDue(view: V, now: number): boolean {
  const ship = view.P.sq[0];
  const nextShip = ship ? (view.P.sqT ?? now) + ship.unit : Infinity;
  return (
    Math.min(
      view.P.bq?.end ?? Infinity,
      view.R.rq?.end ?? Infinity,
      nextShip,
    ) <= now
  );
}

setInterval(() => {
  if (!ctx) return;
  const now = nowT();
  if (queueDue(ctx, now)) {
    render();
    void refresh();
    return;
  }
  let due = false;
  document
    .querySelectorAll<HTMLElement>(buildingView ? '.cd:not(#view *)' : '.cd')
    .forEach((el) => {
      const left = Number(el.dataset.end) - now;
      if (left > 0) return void (el.textContent = dur(left));
      if (!el.dataset.fired) {
        el.dataset.fired = '1';
        due = true;
      }
      el.textContent = 'fertig';
    });
  const planet = updateBar();
  if (planet) {
    buildingView?.update({ ...ctx, P: planet, now });
    updateResearchButtons(planet, ctx.R.research);
    updateShipyardButtons(planet);
  }
  if (due) setTimeout(() => void refresh(), 1500);
}, 1000);
setInterval(() => {
  if (S && !document.hidden) void refresh();
}, 4000);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && S) void refresh();
});

// ----- start -----

async function openInvite(token: string): Promise<void> {
  // The token leaves the address bar at once (history, screenshots).
  history.replaceState(null, '', location.pathname + location.search);
  try {
    const j = await api('/api/invite/check', { token });
    ui.invite = {
      token,
      email: String(j.email),
      galaxies: Number(j.galaxies) || 1,
    };
    ui.auth = 'register';
  } catch (e) {
    ui.auth = 'login';
    toast((e as Error).message, true);
  }
}

const inviteToken = (): string | undefined =>
  /^#invite=([\w-]+)$/.exec(location.hash)?.[1];

window.addEventListener('popstate', () => {
  if (!inviteToken()) go(viewFromUrl(), false);
});

// An invitation link opened in a tab that is already open only changes the hash.
window.addEventListener('hashchange', () => {
  const token = inviteToken();
  if (!token || S) return;
  void openInvite(token).then(() => render(true));
});

async function boot(): Promise<void> {
  const invite = inviteToken();
  try {
    apply((await api('/api/state')) as unknown as GameState);
    homeSystem();
    render(true);
  } catch {
    if (invite) await openInvite(invite);
    ui.auth ??= 'login';
    render(true);
  }
}

void boot();
