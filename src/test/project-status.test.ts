import { describe, expect, it } from 'vitest';
import {
  BACKLOG,
  current,
  graphql,
  main,
  plan,
  WAIT,
  type Deps,
  type Graphql,
  type Issue,
} from '../../scripts/project-status.ts';

const label = (name: string) => ({ id: `L-${name}`, name });
const issue = (
  labels: string[],
  added: [string, string][] = [],
  closed = false,
): Issue => ({
  id: 'I1',
  number: 1,
  closed,
  labels: labels.map(label),
  added: added.map(([name, at]) => ({ name, at })),
});

describe('project status: plan', () => {
  it('maps every status label to its option', () => {
    expect(plan(issue(['feature', 'in discussion']))).toEqual({
      remove: [],
      status: 'In discussion',
    });
    expect(plan(issue(['ready'])).status).toBe('Ready');
    expect(plan(issue(['in progress'])).status).toBe('In progress');
    expect(plan(issue(['in review'])).status).toBe('In review');
  });

  it('puts an issue without a status label into the backlog', () => {
    expect(plan(issue(['enhancement', 'idea']))).toEqual({
      remove: [],
      status: BACKLOG,
    });
    expect(plan(issue([]))).toEqual({ remove: [], status: BACKLOG });
  });

  it('keeps the status label added last and removes the others', () => {
    const i = issue(
      ['in progress', 'feature', 'ready'],
      [
        ['ready', '2026-11-14T10:00:00Z'],
        ['in progress', '2026-11-14T11:00:00Z'],
        ['feature', '2026-11-14T12:00:00Z'],
      ],
    );
    expect(current(i)?.name).toBe('in progress');
    expect(plan(i)).toEqual({
      remove: [label('ready')],
      status: 'In progress',
    });
  });

  it('takes the last time a label was added', () => {
    // ready, then in review, then ready again: ready holds.
    const i = issue(
      ['ready', 'in review'],
      [
        ['ready', '2026-11-14T10:00:00Z'],
        ['in review', '2026-11-14T11:00:00Z'],
        ['ready', '2026-11-14T12:00:00Z'],
      ],
    );
    expect(plan(i)).toEqual({ remove: [label('in review')], status: 'Ready' });
  });

  it('without times, the later status in the order of the work wins', () => {
    expect(plan(issue(['in review', 'in discussion', 'ready']))).toEqual({
      remove: [label('in discussion'), label('ready')],
      status: 'In review',
    });
    // A label with a time beats one without.
    expect(
      plan(issue(['in review', 'ready'], [['ready', '2026-11-14T10:00:00Z']]))
        .status,
    ).toBe('Ready');
  });

  it('leaves closed issues alone', () => {
    expect(plan(issue(['ready', 'in progress'], [], true))).toEqual({
      remove: [],
      status: null,
    });
  });
});

const OPTIONS = [
  'Backlog',
  'In discussion',
  'Ready',
  'In progress',
  'In review',
  'Done',
];

interface Item {
  id: string;
  project: string;
  status: string | null;
}

/** A fake GitHub: one repository, one project, recorded calls. */
function github(opts: {
  issues: Issue[];
  items?: Record<string, Item[]>;
  options?: string[];
  project?: boolean;
  /** Item lookups before the item appears (the project's Auto-add). */
  appearsAfter?: number;
}) {
  const calls: { token: string; op: string; vars: Record<string, unknown> }[] =
    [];
  const items = opts.items ?? {};
  let lookups = 0;
  const node = (i: Issue) => ({
    id: i.id,
    number: i.number,
    closed: i.closed,
    labels: { nodes: i.labels },
    timelineItems: {
      nodes: i.added.map((a) => ({ createdAt: a.at, label: { name: a.name } })),
    },
  });
  const project = () =>
    opts.project === false
      ? { projectV2: null }
      : {
          projectV2: {
            id: 'P',
            field: {
              id: 'F',
              options: (opts.options ?? OPTIONS).map((n) => ({
                id: `O-${n}`,
                name: n,
              })),
            },
          },
        };
  // Two pages of open issues.
  const page = (after: unknown) =>
    after
      ? {
          pageInfo: { hasNextPage: false, endCursor: 'c2' },
          nodes: opts.issues.slice(1).map(node),
        }
      : {
          pageInfo: { hasNextPage: true, endCursor: 'c1' },
          nodes: opts.issues.slice(0, 1).map(node),
        };
  const repository = (vars: Record<string, unknown>) => {
    if (!('number' in vars)) return { issues: page(vars.after) };
    const i = opts.issues.find((x) => x.number === vars.number);
    return { issue: i ? node(i) : null };
  };
  const projectItems = (id: string) => {
    lookups++;
    const list = lookups > (opts.appearsAfter ?? 0) ? (items[id] ?? []) : [];
    return {
      nodes: list.map((i) => ({
        id: i.id,
        project: { id: i.project },
        fieldValueByName: i.status ? { name: i.status } : null,
      })),
    };
  };
  const answer: Record<
    string,
    (vars: Record<string, unknown>) => Record<string, unknown>
  > = {
    user: () => ({ user: project() }),
    repository: (vars) => ({ repository: repository(vars) }),
    node: (vars) => ({
      node: { projectItems: projectItems(vars.id as string) },
    }),
  };
  const gql: Graphql = (token, query, vars) => {
    const op = /(\w+)\(/.exec(query.replace(/^\s*(query|mutation)/, ''))![1]!;
    calls.push({ token, op, vars });
    return Promise.resolve(answer[op]?.(vars) ?? {});
  };
  return { gql, calls };
}

const ENV = {
  GITHUB_REPOSITORY: 'Heiss/nova-imperium',
  GITHUB_TOKEN: 'gh',
  PROJECT_TOKEN: 'pt',
  PROJECT_NUMBER: '5',
};

function deps(gql: Graphql) {
  const log: string[] = [];
  const slept: number[] = [];
  const d: Deps = {
    gql,
    sleep: (ms) => {
      slept.push(ms);
      return Promise.resolve();
    },
    log: (line) => log.push(line),
  };
  return { d, log, slept };
}

describe('project status: main', () => {
  it('sets the status with the project token and removes labels with the GitHub token', async () => {
    const i = issue(
      ['ready', 'in progress'],
      [
        ['ready', '2026-11-14T10:00:00Z'],
        ['in progress', '2026-11-14T11:00:00Z'],
      ],
    );
    const { gql, calls } = github({
      issues: [i],
      items: {
        I1: [
          { id: 'X', project: 'OTHER', status: 'Ready' },
          { id: 'IT', project: 'P', status: 'Ready' },
        ],
      },
    });
    const { d, log } = deps(gql);
    expect(await main(['issue', '1'], ENV, d)).toBe(0);
    const ops = calls.map((c) => [c.op, c.token]);
    expect(ops).toEqual([
      ['user', 'pt'],
      ['repository', 'gh'],
      ['removeLabelsFromLabelable', 'gh'],
      ['node', 'pt'],
      ['updateProjectV2ItemFieldValue', 'pt'],
    ]);
    expect(calls[0]!.vars).toEqual({
      login: 'Heiss',
      number: 5,
      field: 'Status',
    });
    expect(calls[2]!.vars).toEqual({ id: 'I1', labels: ['L-ready'] });
    expect(calls[4]!.vars).toEqual({
      project: 'P',
      item: 'IT',
      field: 'F',
      option: 'O-In progress',
    });
    expect(log).toEqual(['#1: removed ready', '#1: Ready → In progress']);
  });

  it('does not write a status the item already has', async () => {
    const { gql, calls } = github({
      issues: [issue(['in review'])],
      items: { I1: [{ id: 'IT', project: 'P', status: 'In review' }] },
    });
    const { d, log } = deps(gql);
    expect(await main(['issue', '1'], { ...ENV, PROJECT_OWNER: 'me' }, d)).toBe(
      0,
    );
    expect(calls.map((c) => c.op)).toEqual(['user', 'repository', 'node']);
    expect(calls[0]!.vars.login).toBe('me');
    expect(log).toEqual(['#1: already In review']);
  });

  it('writes Backlog to an item without status', async () => {
    const { gql, calls } = github({
      issues: [issue([])],
      items: { I1: [{ id: 'IT', project: 'P', status: null }] },
    });
    const { d, log } = deps(gql);
    expect(await main(['issue', '1'], ENV, d)).toBe(0);
    expect(calls.at(-1)!.vars.option).toBe('O-Backlog');
    expect(log).toEqual(['#1: no status → Backlog']);
  });

  it('leaves a closed issue alone', async () => {
    const { gql, calls } = github({
      issues: [issue(['ready', 'in review'], [], true)],
    });
    const { d, log } = deps(gql);
    expect(await main(['issue', '1'], ENV, d)).toBe(0);
    expect(calls.map((c) => c.op)).toEqual(['user', 'repository']);
    expect(log).toEqual(['#1: closed, left alone']);
  });

  it("waits for the project's Auto-add, then gives up", async () => {
    const added = github({
      issues: [issue(['ready'])],
      items: { I1: [{ id: 'IT', project: 'P', status: 'Backlog' }] },
      appearsAfter: 2,
    });
    const a = deps(added.gql);
    expect(await main(['issue', '1'], ENV, a.d)).toBe(0);
    expect(a.slept).toEqual([WAIT.ms, WAIT.ms]);
    expect(a.log).toEqual(['#1: Backlog → Ready']);

    const never = github({ issues: [issue(['ready'])] });
    const n = deps(never.gql);
    expect(await main(['issue', '1'], ENV, n.d)).toBe(1);
    expect(n.slept).toHaveLength(WAIT.tries - 1);
    expect(n.log).toEqual(['#1: not in the project']);
  });

  it('syncs every open issue on all pages and does not wait', async () => {
    const one = issue(['in discussion']);
    const two = { ...issue(['ready']), id: 'I2', number: 2 };
    const { gql, calls } = github({
      issues: [one, two],
      items: { I1: [{ id: 'IT1', project: 'P', status: null }] },
    });
    const { d, log, slept } = deps(gql);
    expect(await main(['all'], ENV, d)).toBe(0);
    expect(
      calls.filter((c) => c.op === 'repository').map((c) => c.vars.after),
    ).toEqual([null, 'c1']);
    expect(slept).toEqual([]);
    expect(log).toEqual([
      '#1: no status → In discussion',
      '#2: not in the project',
      '1 open issue(s) not in the project',
    ]);
  });

  it('fails on a missing setting, project, field option or issue', async () => {
    const ok = github({ issues: [] });
    await expect(
      main(['all'], { ...ENV, PROJECT_TOKEN: '' }, deps(ok.gql).d),
    ).rejects.toThrow('PROJECT_TOKEN is not set');
    await expect(main(['issue', '7'], ENV, deps(ok.gql).d)).rejects.toThrow(
      'Issue #7 not found',
    );
    await expect(main(['issue'], ENV, deps(ok.gql).d)).rejects.toThrow('Usage');
    const none = github({ issues: [], project: false });
    await expect(main(['all'], ENV, deps(none.gql).d)).rejects.toThrow(
      'Project 5 of Heiss not found',
    );
    const lacking = github({
      issues: [],
      options: ['Todo', 'In Progress', 'Done'],
    });
    await expect(main(['all'], ENV, deps(lacking.gql).d)).rejects.toThrow(
      '„Status“ lacks the options: Backlog, In discussion, Ready, In progress, In review',
    );
  });
});

describe('project status: graphql', () => {
  const respond = (status: number, body: unknown) => {
    const seen: RequestInit[] = [];
    globalThis.fetch = ((_url: string, init: RequestInit) => {
      seen.push(init);
      return Promise.resolve(new Response(JSON.stringify(body), { status }));
    }) as typeof fetch;
    return seen;
  };

  it('sends the token and returns the data', async () => {
    const original = globalThis.fetch;
    try {
      const seen = respond(200, { data: { a: 1 } });
      expect(await graphql('t', 'query { a }', { x: 1 })).toEqual({ a: 1 });
      expect((seen[0]!.headers as Record<string, string>).authorization).toBe(
        'Bearer t',
      );
      expect(JSON.parse(seen[0]!.body as string)).toEqual({
        query: 'query { a }',
        variables: { x: 1 },
      });
      respond(200, { data: null, errors: [{ message: 'no' }] });
      await expect(graphql('t', 'q', {})).rejects.toThrow('GraphQL 200: no');
      respond(401, { message: 'Bad credentials' });
      await expect(graphql('t', 'q', {})).rejects.toThrow(
        'GraphQL 401: {"message":"Bad credentials"}',
      );
    } finally {
      globalThis.fetch = original;
    }
  });
});
