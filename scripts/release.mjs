import { execFileSync } from 'node:child_process';

const repository = 'Heiss/nova-imperium';
const originPattern =
  /^(https:\/\/github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)heiss\/nova-imperium(\.git)?\/?$/i;
const dryRun = process.argv[2] === '--dry-run';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();

function verifyCheckout() {
  if (process.argv.length !== (dryRun ? 3 : 2))
    throw new Error('Usage: node scripts/release.mjs [--dry-run]');
  if (git('branch', '--show-current') !== 'main')
    throw new Error('Switch to main before creating a release.');
  if (git('status', '--porcelain'))
    throw new Error('Commit or stash local changes before creating a release.');
  const urls = [
    git('remote', 'get-url', '--all', 'origin'),
    git('remote', 'get-url', '--push', '--all', 'origin'),
  ];
  if (urls.some((url) => !originPattern.test(url)))
    throw new Error(
      `Set origin to the canonical GitHub repository (${repository}).`,
    );
}

async function verifyCI(commit) {
  const query = new URLSearchParams({
    branch: 'main',
    event: 'push',
    head_sha: commit,
    per_page: '1',
  });
  const url = `https://api.github.com/repos/${repository}/actions/workflows/ci.yml/runs?${query}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!response.ok)
    throw new Error(`Could not check GitHub CI (HTTP ${response.status}).`);
  const {
    workflow_runs: [run],
  } = await response.json();
  if (run?.head_sha !== commit || run.conclusion !== 'success') {
    const details = run
      ? ` (${run.conclusion ?? run.status}) ${run.html_url}`
      : '';
    throw new Error(
      `Wait for successful CI on main at ${commit.slice(0, 7)}.${details}`,
    );
  }
}

function releaseTag(commit) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Berlin',
    year: '2-digit',
    month: 'numeric',
  }).formatToParts();
  const year = parts.find(({ type }) => type === 'year').value;
  const month = parts.find(({ type }) => type === 'month').value;
  const prefix = `${year}.${Number(month)}.`;
  const tags = git(
    'tag',
    '--list',
    '--sort=-version:refname',
    `${prefix}*`,
  ).split('\n');
  const valid = tags.filter((tag) =>
    /^(0|[1-9][0-9]*)$/.test(tag.slice(prefix.length)),
  );
  const onCommit = new Set(git('tag', '--points-at', commit).split('\n'));
  const existing = valid.find((tag) => onCommit.has(tag));
  if (existing) return { tag: existing, existing: true };
  const latest = valid[0];
  const next = latest ? BigInt(latest.slice(prefix.length)) + 1n : 0n;
  return { tag: `${prefix}${next}`, existing: false };
}

async function release() {
  verifyCheckout();
  git('fetch', '--tags', 'origin', 'main');
  const commit = git('rev-parse', 'FETCH_HEAD^{commit}');
  git('merge-base', '--is-ancestor', 'HEAD', commit);
  await verifyCI(commit);
  const { tag, existing } = releaseTag(commit);
  if (dryRun) {
    console.log(`Would push ${tag} for ${commit.slice(0, 7)}.`);
    return;
  }
  git('merge', '--ff-only', commit);
  if (!existing) git('tag', '-a', tag, commit, '-m', `Release ${tag}`);
  try {
    git('push', 'origin', `refs/tags/${tag}`);
  } catch {
    throw new Error(
      `Could not push ${tag}. The local tag is available for retry: git push origin refs/tags/${tag}`,
    );
  }
  console.log(`Release tag ${tag} is on GitHub (${commit.slice(0, 7)}).`);
}

try {
  await release();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
