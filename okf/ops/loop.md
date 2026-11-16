---
type: process
title: Release loop
description: How Claude works through a release with /loop - plan with the owner by labels, clarify, build, make the release pull request ready, keep it ready until the owner merges it, stop.
---

# Release loop

The owner runs `/loop` in Claude Code without a prompt; Claude Code then
reads `.claude/loop.md` (project file, plain Markdown, at most 25,000 bytes,
edits apply from the next iteration). Without an interval Claude chooses the
pause itself, between one minute and one hour, and ends the loop with
`ScheduleWakeup` and `stop`. A loop runs only while the session runs and
ends after seven days at the latest (Claude Code documentation on scheduled
tasks).

* **[E]** One step per iteration, chosen from the state on GitHub in this
  order: finish the own open pull request, make the release ready, plan
  the release, clarify the next issue, build it (owner, 2026-11-12).
* **[E]** Labels instead of milestones (owner, 2026-11-14), so issues can
  be filtered and a GitHub Project can group them; titles stay as they
  are:
  * status: `ready` (in the next release), `in progress` (Claude started
    it), `in review` (its pull request is ready and waits for CI or
    review), `in discussion` (planned for a later release); an open issue
    without a status label is in the backlog;
  * kind: `feature` and `idea` (instead of „Idea –“ in the title); issues
    of the CI are `feature` too [V].
  The milestones `next release` and `planned release` are no longer used
  by the loop.
* **[V]** Conditions on the labels: „Make the release ready“ when no open
  issue has `ready`, `in progress` or `in review` and the release pull
  request is open; „Plan the release“ when none has those labels and no
  release pull request is open. A merged release closes the release pull
  request, so the loop stops there and a restarted `/loop` plans next.
* **[E]** The owner's GitHub Project (`users/Heiss/projects/5`) shows the
  status labels in its field „Status“ (owner, 2026-11-14; replaces „the
  owner filters it by the labels“): the workflow „Project status“
  (`.github/workflows/project-status.yml`, `scripts/project-status.ts`,
  tests in `src/test/project-status.test.ts`) runs on every issue that is
  opened, reopened, labelled or unlabelled. The labels lead, the board
  follows; the loop still only sets labels.
  * Only one status label holds: the one added last in the issue's
    timeline stays, the workflow removes the others.
  * No status label is „Backlog“; the options are `Backlog`,
    `In discussion`, `Ready`, `In progress`, `In review`, `Done`.
  * The project's own „Auto-add to project“ adds the issues; the workflow
    waits up to a minute for the item and fails when it does not appear.
  * Closed issues are left to the project's own workflow „Item closed“
    („Done“); „Pull request linked to issue“ is switched off.
  * Run by hand (`workflow_dispatch`), it syncs every open issue once,
    reading each right before its sync, and lists the ones not in the
    project. A run on an issue event for the same issue at the same moment
    can still race it and remove both status labels; the owner accepts
    that risk, because the manual run is rare (owner, 2026-11-14,
    CodeRabbit on #194).
  * Secret `PROJECT_TOKEN`: a classic personal access token with the scope
    `project` [U: a fine-grained token not checked], because a GitHub App
    cannot reach a project of a user; variable `PROJECT_NUMBER`.
* **[V]** Questions to the owner are asked with the question tool inside the
  iteration; the iteration waits for the answer and continues with it. An
  issue counts as clarified when it has a comment that starts with
  `Geklärt` and lists the decisions with the OKF link.
* **[E]** The loop asks the owner first what a release should bring, with
  proposals from the open issues; **infrastructure first**, features after
  it (owner, 2026-11-12). The chosen issues get the label `ready`
  (owner, 2026-11-14; before, they formed the milestone `next release`).
* **[E]** When no issue of the release is open any more and the release pull
  request is green with its candidate image, the loop tells the owner. The
  owner merges the release pull request; that is the release (owner,
  2026-11-12, [Branching and release](/ops/branching-release.md)). The loop
  **stops** once the owner has merged it, not when it has told the owner
  (owner, 2026-11-13, #149; replaces „tells the owner and stops“).
* **[E]** The release pull request of `main` is a draft with the cheap run
  after every rebuild; its CI Gate is red on purpose (owner, 2026-11-13 and
  2026-11-14, #147, [Branching and release](/ops/branching-release.md)).
  In the step „Make the release ready“ the loop checks the single cheap
  jobs and the texts, then marks it „Ready for review“: that starts the
  full run (`release-ready.yml`). It waits for the green CI Gate of that
  run and for the candidate image, then tells the owner. A rebuild during
  the wait (a push to `main`) sets it back to draft: the loop marks it
  ready again.
* **[E]** No merge freeze (owner, 2026-11-13, #149): every merge into
  `main` while the release pull request is open, not only a security
  merge, rebuilds it and sets it back to draft, and its last full run no
  longer counts. The loop keeps running after „Make the release ready“
  until the owner has merged the release pull request; after each rebuild
  it makes the release ready again (texts and cheap jobs, „Ready for
  review“, the green full run and the candidate image) and then tells the
  owner again. That message is the only notice besides the draft state:
  no comment on the release pull request and no issue.
* **[E]** „Plan the release“ does not start the next cycle before the
  release is out (owner, 2026-11-14, #149): it needs no open release pull
  request, so a restarted `/loop` finds the same state on GitHub. The
  loop sees the release as the merge of the release pull request from
  `release/main` (after that merge `release-pr.sh` opens no new one,
  `tag.yml` takes over) and stops. While the release pull request stays
  ready and green, the loop only waits and does not repeat its message
  (#149). The owner decided this first with the milestone („stays open
  until the release is merged“); with labels the open release pull
  request takes its place.
* **[E]** The loop marks the release pull request ready only after the
  run of „Release pull request“ for the current `main` commit has
  completed successfully: a rebuild still running would push a new head
  after the ready mark and leave it ready without a full run (CodeRabbit
  on #184, fixed 2026-11-14).
* **[E]** After a restart the loop does not know whether it told the owner
  about a ready and green release pull request: it tells the owner once
  more and then waits (owner, 2026-11-14). When the loop is about to end
  (seven days or the session) before the release is merged, it tells the
  owner, who starts `/loop` again; the new loop finds the state on GitHub
  (owner, 2026-11-14).
* **[E]** While a released hotfix is not merged back, „Ready for review“
  is refused: „Release ready“ sets the pull request back to draft and
  comments why (owner, 2026-11-14, #147); the loop does not mark it ready
  then.
* **[V]** The loop does not mark it ready while the last run of „Release
  pull request“ failed (a version held by another release branch): before
  #147 the workflow kept it a draft, now only the draft that every rebuild
  has shows it.
* **[E]** The release pull request, `CHANGELOG.md` and `VERSION` come only
  from `scripts/release-pr.sh`: the changelog section from the fragments,
  the version from the tags, the list of pull requests from the Git
  history (squash commits ending in `(#N)`). The loop never writes them
  by hand; it refreshes them by running the workflow (owner, 2026-11-12).
* **[E]** The rules of the project stay as they are: do not assume
  anything that no decision or source gives, merges under O4, never a
  merge of a release pull request. Questions to the owner follow the next
  rule (owner, 2026-11-15; before, every decision was asked with 3 to 5
  options).
* **[E]** Fewer questions (owner, 2026-11-15): where a recommendation is
  consistent with the owner's earlier decisions, take it without asking,
  record it as [V] with „taken as recommended“ and list it in the
  `Geklärt` comment; the owner adjusts it while testing. Ask, with 3 to 5
  options, only when unsure: no recommendation is clearly best, it is not
  consistent with an earlier decision, it changes a rule of the project,
  or it concerns security, data loss or game values that no source gives.
* **[E]** Up to four own pull requests may be open at a time; subagents build
  issues that don't depend on each other in their own git worktrees, Claude
  reviews each diff and opens, finishes and merges the pull requests itself
  (owner, 2026-11-12: two, replacing „one own pull request at a time“;
  owner, 2026-11-15: four, confirmed after the loop already worked with
  four while this bundle still said two). Open pull requests of design studies do not count (owner, 2026-11-16). At most two subagents build at
  the same time (owner, 2026-11-16): a pull request that only waits for CI
  or a review costs little, but every building agent costs memory (the
  out-of-memory stop of 2026-11-15 came from Stryker and E2E of two agents
  at once) and usage; merge conflicts are no longer the reason, since
  most of them were in `okf/log.md` before #212.
* **[E]** Two subagents always build (owner, 2026-11-16): when one
  finishes, the loop starts the next issue with `ready` and a `Geklärt`
  comment that depends neither on the open pull requests nor on an issue
  being built at once, also while it waits on CI or a
  review. Only the main agent waits, and it does not build itself; it
  finishes the open pull requests, cleans up (worktrees, labels), looks for
  new issues and pull requests, gets the owner's decisions so that the next
  issues become `ready`, and does whatever else keeps both agents building.
  Waiting with a free place wastes the time of the release; the limit of
  two stays for memory and usage.
* **[E]** An open pull request takes `main` in only when it is the next one
  to merge (CI green on its head, every finding answered), when GitHub
  reports a conflict (then no CI starts, as seen on #194), or when it needs code
  that just landed on `main` (owner, 2026-11-15). Reason: `main` requires
  a branch to be up to date before the merge, so taking `main` in after
  every merge reran CI on every open pull request; from 2026-11-12 to
  2026-11-15, 89 of 182 CI runs of the loop's pull requests (1,383 of
  2,425 CI minutes) ran on such merges, 112 merges in 42 of 49 merged pull
  requests. Expected [V]: about a third fewer CI minutes and fewer loop
  turns; the time to merge stays about the same, because each merge still
  waits for one full run of the next pull request, and the median gap of
  58 minutes between merges shows that merging is not the bottleneck.
* **[E]** Before the loop makes the release pull request ready, it merges
  Renovate's ordinary patch and minor pull requests of versions from 1.0
  on (owner, 2026-11-16): one at a time, each under O4 (green CI Gate, no
  blocking finding, every finding answered) on a head up to date with
  `main`; Renovate rebases the others itself. Reason:
  normal updates merge themselves only for patch (`renovate.json`), so
  minor ones waited without an owner; on 2026-11-16 six of them were open,
  the oldest since 2026-11-13. **[V]** A red one stays open and is named
  to the owner with the release, it is not fixed like a security pull
  request; major updates and minor updates below 1.0 wait for the owner,
  each with one issue that the loop finds or opens without a status label
  (CodeRabbit on #266; see [Branching and release](/ops/branching-release.md)).
* **[E]** A red security pull request of Renovate (from GitHub's Dependabot
  alerts, `[SECURITY]` at the end of its title) is handled like an own pull
  request in the first step (owner, 2026-11-13, #148; patch, pin and
  digest security updates merge themselves, minor ones from version 1.0
  on; a major one and a minor one below 1.0 wait for the owner, see
  [Branching and release](/ops/branching-release.md)): the loop finds the
  root cause and fixes it in its own `claude/…` pull request, never by a
  push to the Renovate branch; if it cannot, it asks the owner. That fix
  pull request does not count toward the limit of four open own pull
  requests (security first).
* **[E]** Local checks (owner, 2026-11-15): `pnpm check` and the relevant
  E2E tests run before the push after which a pull request is marked
  ready, and after a merge of `main` with a conflict in code; other pushes
  of a draft rely on its CI, which runs the same checks (lint, types, unit
  tests, build, E2E) on every push of an ordinary pull request. Replaces
  „before every push“. Expected [V]: less agent time and memory (the
  out-of-memory stop of 2026-11-15 came from Stryker and E2E of two agents
  at once), a few more red draft runs.
* **[E]** Saving usage (owner, 2026-11-15; the weekly limit stood at 94 %
  on 2026-11-15): an event that needs nothing (a bot edited a comment,
  CodeRabbit skipped a review, an own reply) gets no tool call and at most
  one line; large output (job logs, whole files, transcripts) is read by a
  subagent or with `grep`, never in the loop's thread; while it waits on CI
  or a review, the loop does not poll and keeps one fallback wakeup of
  about 50 minutes (replaces „20 to 30 minutes“); once a day it adds the
  weekly usage it can see, or „not visible“, to the log entry of its next
  pull request, never in a pull request of its own [U: whether a session
  can read its usage other than from a notice is not checked].
* **[E]** Local Stryker runs before a push only for changed logic files whose
  score is less than about 2 points above their floor in
  `mutation-standard.json` (for example `economy.ts`, `settle.ts`,
  `actions.ts`); data and interface files such as `catalog.ts` or
  `icons.ts` are left to the CI mutation job. A local run does not speed up
  the CI, which keeps its own incremental cache; it only saves a red run
  (owner, 2026-11-12).
* **[E]** Every pull request records its work as a new file in the update
  log, `okf/log/<date>-<short-name>.md`, and changes no other entry
  (owner, 2026-11-15, #212, [Documentation website](/ops/website.md)): a
  merge of `main` into an open branch no longer conflicts at the top of
  one log file, which saves a push and a CI run per merge.
* **[E]** Claude bundles pushes: while the CI of a pull request runs, no
  push of documentation or OKF alone (for example confirmed [V] → [E]); such
  changes go with the next code push, or are pushed before the pull request
  is marked ready. Every push cancels the running CI and starts all jobs
  again (owner, 2026-11-12).
* **[V]** Guards from loop engineering practice: a stop condition a machine
  can check (release pull request merged), the state read
  fresh in every iteration, small reviewable steps, tests never weakened,
  and a hand-back to the owner after two failed attempts at one problem.
* **[V]** While the loop waits on CI or a review it wakes every 20 to 30
  minutes; GitHub events of subscribed pull requests wake it earlier.
* **[E]** Labels are set with the GitHub tools of the session (issue
  update with the full list of labels, so the other labels stay); a label
  that does not exist yet is created by GitHub on first use.
