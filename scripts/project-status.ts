// Project status (owner, 2026-11-14): the status labels of an issue set the
// field „Status“ of the owner's GitHub Project, so its board shows the
// labels the release loop sets. See okf/ops/loop.md.
//
//   node scripts/project-status.ts issue <number>   one issue (issue events)
//   node scripts/project-status.ts all              every open issue
//
// Only one status label holds: the one added last stays, the others are
// removed. No status label means „Backlog“. Closed issues are left alone,
// the project's own workflow „Item closed“ sets „Done“. The project's own
// „Auto-add to project“ adds the issues; an issue not in the project yet is
// waited for (issue events) or skipped (all).
//
// Environment: GITHUB_REPOSITORY (owner/name), GITHUB_TOKEN (reads the issue,
// removes labels), PROJECT_TOKEN (classic token with the scope `project`;
// a GitHub App cannot reach a project of a user), PROJECT_NUMBER, and
// PROJECT_OWNER (the user who owns the project; default: the repository
// owner).

/** Status label → option of the field „Status“, in the order of the work. */
export const STATUS: Readonly<Record<string, string>> = {
  'in discussion': 'In discussion',
  ready: 'Ready',
  'in progress': 'In progress',
  'in review': 'In review',
};
export const BACKLOG = 'Backlog';
const FIELD = 'Status';

export interface Label {
  id: string;
  name: string;
}
export interface Issue {
  id: string;
  number: number;
  closed: boolean;
  labels: Label[];
  /** Names of the labels as they were added, oldest first (timeline). */
  added: string[];
}
export interface Plan {
  /** Status labels to remove. */
  remove: Label[];
  /** Option of „Status“ to set; null leaves the item alone. */
  status: string | null;
}

/** Own keys only: a label named „constructor“ is no status. */
const isStatus = (name: string): boolean => Object.hasOwn(STATUS, name);

/**
 * The status label that holds: of the status labels the issue has, the one
 * added last in the timeline (its order, not its times, which can tie). A
 * label without a recorded event counts as the oldest; among those, the
 * later one in the order of the work wins.
 */
export function current(issue: Issue): Label | null {
  const order = Object.keys(STATUS);
  const present = issue.labels.filter((l) => isStatus(l.name));
  const last = (name: string): number => issue.added.lastIndexOf(name);
  let best: Label | null = null;
  for (const label of present) {
    if (!best) {
      best = label;
      continue;
    }
    const a = last(label.name);
    const b = last(best.name);
    if (
      a > b ||
      (a === b && order.indexOf(label.name) > order.indexOf(best.name))
    )
      best = label;
  }
  return best;
}

export function plan(issue: Issue): Plan {
  if (issue.closed) return { remove: [], status: null };
  const keep = current(issue);
  return {
    remove: issue.labels.filter((l) => isStatus(l.name) && l !== keep),
    status: keep ? STATUS[keep.name]! : BACKLOG,
  };
}

/** Sends a GraphQL request with the token and returns its data. */
export type Graphql = (
  token: string,
  query: string,
  variables: Record<string, unknown>,
) => Promise<Record<string, unknown>>;

export interface Env {
  owner: string;
  repo: string;
  githubToken: string;
  projectToken: string;
  projectOwner: string;
  projectNumber: number;
}

export interface Project {
  id: string;
  fieldId: string;
  /** Option name → option id. */
  options: Map<string, string>;
}

const ISSUE_FIELDS = `id number closed
  labels(first: 100) { nodes { id name } }
  timelineItems(itemTypes: [LABELED_EVENT], last: 100) {
    nodes { ... on LabeledEvent { label { name } } }
  }`;

interface IssueNode {
  id: string;
  number: number;
  closed: boolean;
  labels: { nodes: Label[] };
  timelineItems: { nodes: { label: { name: string } }[] };
}

function toIssue(node: IssueNode): Issue {
  return {
    id: node.id,
    number: node.number,
    closed: node.closed,
    labels: node.labels.nodes,
    added: node.timelineItems.nodes.map((e) => e.label.name),
  };
}

export async function readIssue(
  gql: Graphql,
  env: Env,
  number: number,
): Promise<Issue> {
  const data = await gql(
    env.githubToken,
    `query($owner: String!, $repo: String!, $number: Int!) {
      repository(owner: $owner, name: $repo) {
        issue(number: $number) { ${ISSUE_FIELDS} }
      }
    }`,
    { owner: env.owner, repo: env.repo, number },
  );
  const issue = (data.repository as { issue: IssueNode | null }).issue;
  if (!issue) throw new Error(`Issue #${number} not found`);
  return toIssue(issue);
}

/** Numbers of every open issue; each is read again right before its sync. */
export async function openIssues(gql: Graphql, env: Env): Promise<number[]> {
  const numbers: number[] = [];
  let after: string | null = null;
  do {
    const data = await gql(
      env.githubToken,
      `query($owner: String!, $repo: String!, $after: String) {
        repository(owner: $owner, name: $repo) {
          issues(states: OPEN, first: 100, after: $after) {
            pageInfo { hasNextPage endCursor }
            nodes { number }
          }
        }
      }`,
      { owner: env.owner, repo: env.repo, after },
    );
    const page = (
      data.repository as {
        issues: {
          pageInfo: { hasNextPage: boolean; endCursor: string };
          nodes: { number: number }[];
        };
      }
    ).issues;
    numbers.push(...page.nodes.map((n) => n.number));
    after = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
  } while (after);
  return numbers;
}

export async function readProject(gql: Graphql, env: Env): Promise<Project> {
  const data = await gql(
    env.projectToken,
    `query($login: String!, $number: Int!, $field: String!) {
      user(login: $login) {
        projectV2(number: $number) {
          id
          field(name: $field) {
            ... on ProjectV2SingleSelectField { id options { id name } }
          }
        }
      }
    }`,
    { login: env.projectOwner, number: env.projectNumber, field: FIELD },
  );
  const project = (
    data.user as {
      projectV2: {
        id: string;
        field: { id?: string; options?: { id: string; name: string }[] } | null;
      } | null;
    } | null
  )?.projectV2;
  if (!project)
    throw new Error(
      `Project ${env.projectNumber} of ${env.projectOwner} not found`,
    );
  if (!project.field?.id || !project.field.options)
    throw new Error(`The project has no single select field „${FIELD}“`);
  const options = new Map(project.field.options.map((o) => [o.name, o.id]));
  const missing = [BACKLOG, ...Object.values(STATUS)].filter(
    (name) => !options.has(name),
  );
  if (missing.length)
    throw new Error(`„${FIELD}“ lacks the options: ${missing.join(', ')}`);
  return { id: project.id, fieldId: project.field.id, options };
}

/** The issue's item in the project with its status, or null. */
export async function findItem(
  gql: Graphql,
  env: Env,
  project: Project,
  issue: Issue,
): Promise<{ id: string; status: string | null } | null> {
  const data = await gql(
    env.projectToken,
    `query($id: ID!, $field: String!) {
      node(id: $id) {
        ... on Issue {
          projectItems(first: 50, includeArchived: true) {
            nodes {
              id
              project { id }
              fieldValueByName(name: $field) {
                ... on ProjectV2ItemFieldSingleSelectValue { name }
              }
            }
          }
        }
      }
    }`,
    { id: issue.id, field: FIELD },
  );
  const items = (
    data.node as {
      projectItems: {
        nodes: {
          id: string;
          project: { id: string };
          fieldValueByName: { name?: string } | null;
        }[];
      };
    }
  ).projectItems.nodes;
  const item = items.find((i) => i.project.id === project.id);
  return item
    ? { id: item.id, status: item.fieldValueByName?.name ?? null }
    : null;
}

export interface Deps {
  gql: Graphql;
  sleep: (ms: number) => Promise<void>;
  log: (line: string) => void;
}

/** Waits for the project's „Auto-add“ after a new issue: 6 × 10 s. */
export const WAIT = { tries: 6, ms: 10_000 };

async function removeLabels(
  deps: Deps,
  env: Env,
  issue: Issue,
  remove: Label[],
): Promise<void> {
  if (!remove.length) return;
  await deps.gql(
    env.githubToken,
    `mutation($id: ID!, $labels: [ID!]!) {
      removeLabelsFromLabelable(input: { labelableId: $id, labelIds: $labels }) {
        clientMutationId
      }
    }`,
    { id: issue.id, labels: remove.map((l) => l.id) },
  );
  deps.log(`#${issue.number}: removed ${remove.map((l) => l.name).join(', ')}`);
}

async function setStatus(
  deps: Deps,
  env: Env,
  project: Project,
  item: { id: string },
  status: string,
): Promise<void> {
  await deps.gql(
    env.projectToken,
    `mutation($project: ID!, $item: ID!, $field: ID!, $option: String!) {
      updateProjectV2ItemFieldValue(input: {
        projectId: $project, itemId: $item, fieldId: $field,
        value: { singleSelectOptionId: $option }
      }) { clientMutationId }
    }`,
    {
      project: project.id,
      item: item.id,
      field: project.fieldId,
      option: project.options.get(status)!,
    },
  );
}

/** Applies the plan to one issue; false when its item is missing. */
export async function sync(
  deps: Deps,
  env: Env,
  project: Project,
  issue: Issue,
  wait: boolean,
): Promise<boolean> {
  const first = plan(issue);
  let status = first.status;
  await removeLabels(deps, env, issue, first.remove);
  if (status === null) {
    deps.log(`#${issue.number}: closed, left alone`);
    return true;
  }
  let item = await findItem(deps.gql, env, project, issue);
  let waited = false;
  for (let i = 1; !item && wait && i < WAIT.tries; i++) {
    await deps.sleep(WAIT.ms);
    waited = true;
    item = await findItem(deps.gql, env, project, issue);
  }
  if (!item) {
    deps.log(`#${issue.number}: not in the project`);
    return false;
  }
  // The issue may have changed while waiting: a closed one keeps „Done“.
  if (waited)
    status = plan(await readIssue(deps.gql, env, issue.number)).status;
  if (status === null) {
    deps.log(`#${issue.number}: closed while waiting, left alone`);
    return true;
  }
  if (item.status === status) {
    deps.log(`#${issue.number}: already ${status}`);
    return true;
  }
  await setStatus(deps, env, project, item, status);
  deps.log(`#${issue.number}: ${item.status ?? 'no status'} → ${status}`);
  return true;
}

export async function main(
  args: string[],
  vars: Record<string, string | undefined>,
  deps: Deps,
): Promise<number> {
  const need = (name: string): string => {
    const value = vars[name];
    if (!value) throw new Error(`${name} is not set`);
    return value;
  };
  const [owner, repo] = need('GITHUB_REPOSITORY').split('/') as [
    string,
    string,
  ];
  const env: Env = {
    owner,
    repo,
    githubToken: need('GITHUB_TOKEN'),
    projectToken: need('PROJECT_TOKEN'),
    projectOwner: vars.PROJECT_OWNER || owner,
    projectNumber: Number(need('PROJECT_NUMBER')),
  };
  const [mode, number] = args;
  const project = await readProject(deps.gql, env);
  if (mode === 'issue' && Number(number) > 0) {
    const issue = await readIssue(deps.gql, env, Number(number));
    return (await sync(deps, env, project, issue, true)) ? 0 : 1;
  }
  if (mode === 'all') {
    let missing = 0;
    // Read each issue right before its sync, not from one early snapshot,
    // so a run on an issue event in between is not undone.
    for (const n of await openIssues(deps.gql, env)) {
      const issue = await readIssue(deps.gql, env, n);
      if (!(await sync(deps, env, project, issue, false))) missing++;
    }
    deps.log(`${missing} open issue(s) not in the project`);
    return 0;
  }
  throw new Error('Usage: project-status.ts issue <number> | all');
}

/** GraphQL over HTTPS; throws on HTTP errors and on GraphQL errors. */
export const graphql: Graphql = async (token, query, variables) => {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });
  const body = (await res.json()) as {
    data?: Record<string, unknown>;
    errors?: { message: string }[];
  };
  if (!res.ok || body.errors?.length || !body.data)
    throw new Error(
      `GraphQL ${res.status}: ${body.errors?.map((e) => e.message).join('; ') ?? JSON.stringify(body)}`,
    );
  return body.data;
};

if (import.meta.main)
  main(process.argv.slice(2), process.env, {
    gql: graphql,
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    log: (line) => console.log(line),
  }).then(
    (code) => (process.exitCode = code),
    (error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    },
  );
