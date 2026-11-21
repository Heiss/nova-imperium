import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type Mock,
  vi,
} from 'vitest';
import {
  adminTabKey,
  bindAdminPanel,
  downloadErrorRange,
  enterAdminPanels,
  errorsPageTo,
  eventsPageTo,
  filterByReference,
  forgetAdminPanel,
  moderate,
  openAdminTab,
  panels,
  refreshInvitations,
  refreshMessageReports,
  setMoon,
  showErrors,
  showEvents,
} from './admin-panels.svelte.ts';

type Body = Record<string, unknown>;

const eventPage = (over: Body = {}) => ({
  events: [],
  page: 1,
  pages: 1,
  count: 0,
  limit: 10,
  before: 7,
  ...over,
});
const person = (id = 'u1') => ({ id, name: id, admin: 0 });

let calls: { url: string; body: Body }[];
let answers: Record<string, (body: Body) => unknown>;
let download: Mock<(body: object) => Promise<void>>;

/** The answers of the server by the end of the url; an unlisted one is an empty object. */
const api = vi.fn(async (url: string, body: unknown = {}) => {
  calls.push({ url, body: body as Body });
  const route = url.replace('/api/admin/', '');
  const answer = answers[route]?.(body as Body);
  if (answer instanceof Error) throw answer;
  return (answer ?? {}) as Record<string, unknown>;
});

/** Lets the calls on their way finish. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

const urls = () => calls.map((c) => c.url.replace('/api/admin/', ''));

beforeEach(() => {
  calls = [];
  answers = { events: () => eventPage() };
  download = vi.fn(async () => undefined);
  bindAdminPanel({
    api,
    signedOut: (e) => {
      throw new Error(String(e));
    },
    download,
  });
  forgetAdminPanel();
});
afterEach(() => forgetAdminPanel());

describe('a new admin', () => {
  it('starts on the event log and reads its first page', async () => {
    enterAdminPanels('u_a', 1.7e12);
    await settle();
    expect(panels.tab).toBe('events');
    expect(calls).toEqual([
      {
        url: '/api/admin/events',
        body: { ...panels.fields, since: 0, until: 0, page: 1, before: 0 },
      },
    ]);
    expect(panels.events).toMatchObject({ before: 7 });
    expect(panels.range).toEqual({ since: '2023-11-08', until: '2023-11-14' });
  });

  it('keeps what the panels loaded and the tab while the same admin renders again', async () => {
    enterAdminPanels('u_a', 1.7e12);
    await settle();
    openAdminTab('orders');
    panels.fields = { ...panels.fields, action: 'build' };
    calls = [];
    enterAdminPanels('u_a', 1.8e12);
    await settle();
    expect(calls).toEqual([]);
    expect(panels.tab).toBe('orders');
    expect(panels.fields.action).toBe('build');
    expect(panels.range.until).toBe('2023-11-14');
  });

  it('keeps the opened details of an event while the same admin renders again, and closes them for another admin', async () => {
    enterAdminPanels('u_a', 1.7e12);
    await settle();
    panels.setOpen('event:42', true);
    panels.setOpen('error:7', true);
    panels.setOpen('error:7', false);
    enterAdminPanels('u_a', 1.8e12);
    expect(panels.isOpen('event:42')).toBe(true);
    expect(panels.isOpen('error:7')).toBe(false);
    expect(panels.isOpen('event:43')).toBe(false);
    enterAdminPanels('u_b', 1.8e12);
    await settle();
    expect(panels.isOpen('event:42')).toBe(false);
  });

  it('starts again for another admin and after the page was left', async () => {
    enterAdminPanels('u_a', 1.7e12);
    await settle();
    openAdminTab('errors');
    panels.fields = { ...panels.fields, action: 'build' };
    enterAdminPanels('u_b', 1.7e12);
    await settle();
    expect(panels.tab).toBe('events');
    expect(panels.fields.action).toBe('');
    expect(panels.errors).toBeNull();
    forgetAdminPanel();
    calls = [];
    enterAdminPanels('u_b', 1.7e12);
    await settle();
    expect(urls()).toEqual(['events']);
  });

  it('does not show the answer of a call that was on its way for the admin before', async () => {
    let release = (): void => undefined;
    api.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = () => resolve(eventPage({ page: 9 }));
        }),
    );
    enterAdminPanels('u_a', 1.7e12);
    enterAdminPanels('u_b', 1.7e12);
    await settle();
    release();
    await settle();
    expect(panels.events).toMatchObject({ page: 1 });
  });
});

describe('the tabs', () => {
  beforeEach(async () => {
    enterAdminPanels('u_a', 1.7e12);
    await settle();
    calls = [];
  });

  it('read what the tab needs', async () => {
    answers.stats = () => ({ players: [person()] });
    answers.player = () => ({ days: [], suspension: null, planets: [] });
    answers.orders = () => ({ orders: [], now: 5 });
    openAdminTab('players', 'u1');
    await settle();
    expect(urls()).toEqual(['stats', 'player']);
    expect(calls[1]!.body).toEqual({ player: 'u1' });
    expect(panels.record?.person.id).toBe('u1');
    calls = [];
    openAdminTab('orders', 'p1');
    await settle();
    expect(calls).toEqual([
      { url: '/api/admin/orders', body: { reference: 'p1' } },
    ]);
    expect(panels.orders).toEqual({ orders: [], now: 5 });
    expect(panels.tab).toBe('orders');
  });

  it('keep the player that was opened last when „Spieler“ is opened again', async () => {
    answers.stats = () => ({ players: [person()] });
    answers.player = () => ({ days: [], suspension: null, planets: [] });
    openAdminTab('players', 'u1');
    await settle();
    calls = [];
    openAdminTab('players');
    await settle();
    expect(calls[1]).toMatchObject({ body: { player: 'u1' } });
  });

  it('show no record for a player who is not in the statistics, and none without a player', async () => {
    answers.stats = () => ({ players: [person('u2')] });
    openAdminTab('players');
    await settle();
    expect(urls()).toEqual(['stats']);
    expect(panels.record).toBeNull();
    expect(panels.stats).toHaveLength(1);
    openAdminTab('players', 'u1');
    await settle();
    expect(panels.record).toBeNull();
  });

  it('read the errors and the invitations', async () => {
    answers.errors = () => eventPage({ errors: [] });
    answers.invitations = () => ({ invitations: [] });
    openAdminTab('errors');
    openAdminTab('invitations');
    await settle();
    expect(urls()).toEqual(['errors', 'invitations']);
    expect(panels.invitations).toEqual({ list: [] });
  });

  it('read nothing for the tabs of the universe and the message', async () => {
    openAdminTab('universe');
    openAdminTab('announce');
    await settle();
    expect(calls).toEqual([]);
    expect(panels.tab).toBe('announce');
  });

  it('do nothing while no panel is shown', async () => {
    forgetAdminPanel();
    openAdminTab('errors');
    await refreshInvitations();
    expect(calls).toEqual([]);
    expect(panels.tab).toBe('events');
  });
});

describe('the event log', () => {
  beforeEach(async () => {
    enterAdminPanels('u_a', 1.7e12);
    await settle();
    calls = [];
  });

  it('reads by the typed filter, the days as times, and pages with the same filter and the marker', async () => {
    panels.fields = {
      ...panels.fields,
      action: 'build',
      since: '2026-11-20',
      limit: '25',
    };
    await showEvents();
    expect(calls[0]!.body).toMatchObject({
      action: 'build',
      since: new Date(2026, 10, 20).getTime(),
      limit: '25',
      page: 1,
      before: 0,
    });
    // What is typed afterwards belongs to the next „Anzeigen“, not to the page.
    panels.fields = { ...panels.fields, action: 'other' };
    await eventsPageTo(2);
    expect(calls[1]!.body).toMatchObject({
      action: 'build',
      page: 2,
      before: 7,
    });
  });

  it('shows the words of a refusal as a note and clears it with the next call', async () => {
    answers.events = () => new Error('Nur für Admins.');
    await showEvents();
    expect(panels.notice).toBe('Nur für Admins.');
    answers.events = () => eventPage();
    await showEvents();
    expect(panels.notice).toBeNull();
  });

  it('leaves the note of an old call to the newer one', async () => {
    const late: ((e: Error) => void)[] = [];
    api.mockImplementationOnce(
      () => new Promise((_, reject) => late.push(reject)),
    );
    const old = showEvents();
    await showEvents();
    late[0]!(new Error('alt'));
    await old;
    expect(panels.notice).toBeNull();
  });

  it('shows only the newest page', async () => {
    const waiting: ((page: unknown) => void)[] = [];
    api.mockImplementationOnce(
      () => new Promise((resolve) => waiting.push(resolve as never)),
    );
    const old = showEvents();
    answers.events = () => eventPage({ page: 2 });
    await showEvents();
    waiting[0]!(eventPage({ page: 1 }));
    await old;
    expect(panels.events).toMatchObject({ page: 2 });
  });

  it('is filtered by a reference, on the first page of the log', async () => {
    openAdminTab('orders');
    await settle();
    calls = [];
    filterByReference('p1_2_3');
    await settle();
    expect(panels.tab).toBe('events');
    expect(panels.fields.reference).toBe('p1_2_3');
    expect(calls[0]!.body).toMatchObject({ reference: 'p1_2_3', page: 1 });
  });

  it('is filtered by a player of a record, the player filter set to it', async () => {
    openAdminTab('events', 'u1');
    await settle();
    expect(panels.fields.player).toBe('u1');
    expect(calls[0]!.body).toMatchObject({ player: 'u1' });
  });
});

describe('the record of a player', () => {
  beforeEach(async () => {
    enterAdminPanels('u_a', 1.7e12);
    await settle();
    answers.stats = () => ({ players: [person()] });
    answers.player = () => ({ days: [], suspension: null, planets: [] });
    openAdminTab('players', 'u1');
    await settle();
    calls = [];
  });

  it('sets a moon at a planet and reads the record again', async () => {
    await setMoon('p1', 12);
    expect(calls[0]).toEqual({
      url: '/api/admin/moon',
      body: { planet: 'p1', chance: 12 },
    });
    expect(urls().slice(1)).toEqual(['stats', 'player']);
  });

  it('moderates the player and reads the record again', async () => {
    await moderate({ player: 'u1', action: 'ban', hours: '0', reason: 'x' });
    expect(calls[0]).toEqual({
      url: '/api/admin/moderate',
      body: { player: 'u1', action: 'ban', hours: '0', reason: 'x' },
    });
    expect(urls().slice(1)).toEqual(['stats', 'player']);
  });

  it('shows a refusal and does not read the record again', async () => {
    answers.moderate = () => new Error('Nein.');
    await moderate({});
    expect(panels.notice).toBe('Nein.');
    expect(urls()).toEqual(['moderate']);
  });
});

describe('the errors', () => {
  beforeEach(async () => {
    enterAdminPanels('u_a', 1.7e12);
    await settle();
    answers.errors = (b) => eventPage({ errors: [], page: b.page, before: 3 });
    calls = [];
  });

  it('reads by the kind and the number per page, pages with the marker, from the first page again for a new filter', async () => {
    panels.errorFields = { kind: 'client', limit: '25' };
    await showErrors();
    expect(calls[0]!.body).toEqual({
      kind: 'client',
      limit: '25',
      page: 1,
      before: 0,
    });
    await errorsPageTo(2);
    expect(calls[1]!.body).toMatchObject({ page: 2, before: 3 });
    await showErrors();
    expect(calls[2]!.body).toMatchObject({ page: 1, before: 0 });
  });

  it('shows the words of a refusal and clears the note with the next call', async () => {
    answers.errors = () => new Error('Zu viele.');
    await showErrors();
    expect(panels.errorNotice).toBe('Zu viele.');
    answers.errors = () => eventPage({ errors: [] });
    await showErrors();
    expect(panels.errorNotice).toBeNull();
  });

  it('leaves the note of an old failure to the newer request', async () => {
    const late: ((e: Error) => void)[] = [];
    api.mockImplementationOnce(
      () => new Promise((_, reject) => late.push(reject)),
    );
    const old = showErrors();
    await showErrors();
    late[0]!(new Error('alt'));
    await old;
    expect(panels.errorNotice).toBeNull();
  });

  it('downloads the days typed in, whole days', async () => {
    panels.range = { since: '2026-11-14', until: '2026-11-20' };
    await downloadErrorRange();
    expect(download).toHaveBeenCalledWith({
      since: new Date(2026, 10, 14).getTime(),
      until: new Date(2026, 10, 20, 23, 59, 59, 999).getTime(),
    });
  });

  it('shows the refusal of the download as a note', async () => {
    download.mockRejectedValueOnce(
      new Error('Der Download ist fehlgeschlagen.'),
    );
    await downloadErrorRange();
    expect(panels.errorNotice).toBe('Der Download ist fehlgeschlagen.');
  });
});

describe('the invitations', () => {
  beforeEach(async () => {
    enterAdminPanels('u_a', 1.7e12);
    await settle();
    calls = [];
  });

  it('are read again, the refusal standing in the place of the list', async () => {
    answers.invitations = () => ({
      invitations: [{ id: 'i', email: 'a@b', created: 1, expires: 2 }],
    });
    await refreshInvitations();
    expect(panels.invitations).toEqual({
      list: [{ id: 'i', email: 'a@b', created: 1, expires: 2 }],
    });
    answers.invitations = () => new Error('Nein.');
    await refreshInvitations();
    expect(panels.invitations).toEqual({ error: 'Nein.' });
  });

  it('show only the newest answer', async () => {
    const waiting: ((answer: Record<string, unknown>) => void)[] = [];
    api.mockImplementationOnce(
      () => new Promise((resolve) => waiting.push(resolve)),
    );
    const old = refreshInvitations();
    answers.invitations = () => ({ invitations: [] });
    await refreshInvitations();
    waiting[0]!({ invitations: [{ id: 'old' }] });
    await old;
    expect(panels.invitations).toEqual({ list: [] });
  });
});

describe('the arrow keys on the tabs', () => {
  const press = (key: string, tab = true) => {
    const event = {
      key,
      preventDefault: vi.fn(),
      target: { closest: () => (tab ? {} : null) },
    };
    adminTabKey(event as unknown as KeyboardEvent);
    return event;
  };
  let focused: string[];

  beforeEach(async () => {
    focused = [];
    vi.stubGlobal('document', {
      querySelector: (sel: string) => ({ focus: () => focused.push(sel) }),
    });
    enterAdminPanels('u_a', 1.7e12);
    await settle();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('move to the next tab and focus it, the first one being „Ereignisprotokoll“', () => {
    const event = press('ArrowRight');
    expect(event.preventDefault).toHaveBeenCalled();
    expect(panels.tab).toBe('players');
    expect(focused).toEqual(['#admin-tab-players']);
  });

  it('go round: left from the first tab to the last, Home to the first, End to the last', () => {
    press('ArrowLeft');
    expect(panels.tab).toBe('announce');
    press('ArrowRight');
    expect(panels.tab).toBe('events');
    press('End');
    expect(panels.tab).toBe('announce');
    press('Home');
    expect(panels.tab).toBe('events');
  });

  it('read what the tab needs, as a click does', async () => {
    calls = [];
    press('End');
    press('Home');
    await settle();
    expect(urls()).toEqual(['events']);
  });

  it('leave every other key and every other element alone', () => {
    expect(press('a').preventDefault).not.toHaveBeenCalled();
    expect(press('ArrowRight', false).preventDefault).not.toHaveBeenCalled();
    expect(panels.tab).toBe('events');
    expect(focused).toEqual([]);
  });
});

describe('the reported private messages (#226)', () => {
  beforeEach(async () => {
    enterAdminPanels('u_a', 1.7e12);
    await settle();
    calls = [];
  });

  it('are read when the tab opens, each opening one request, the refusal standing in the place of the list', async () => {
    answers['message-reports'] = () => ({ reports: [] });
    openAdminTab('reports');
    await settle();
    expect(urls()).toEqual(['message-reports']);
    expect(panels.messageReports).toEqual({ list: [] });
    openAdminTab('reports');
    await settle();
    expect(urls()).toEqual(['message-reports', 'message-reports']);
    answers['message-reports'] = () => new Error('Nein.');
    await refreshMessageReports();
    expect(panels.messageReports).toEqual({ error: 'Nein.' });
  });

  it('show only the newest answer', async () => {
    const waiting: ((answer: Record<string, unknown>) => void)[] = [];
    api.mockImplementationOnce(
      () => new Promise((resolve) => waiting.push(resolve)),
    );
    const old = refreshMessageReports();
    answers['message-reports'] = () => ({ reports: [] });
    await refreshMessageReports();
    waiting[0]!({ reports: [{ id: 9 }] });
    await old;
    expect(panels.messageReports).toEqual({ list: [] });
  });

  it('are dropped for another admin', () => {
    panels.messageReports = { list: [] };
    enterAdminPanels('u_b', 1.7e12);
    expect(panels.messageReports).toBeNull();
  });
});
