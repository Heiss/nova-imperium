---
type: process
title: Briefs for subagents
description: How the main agent writes a task for a building subagent so that a smaller model can do it, and what went wrong before - collected from the release loop.
---

# Briefs for subagents

The main agent plans, asks the owner and merges; subagents build
([Release loop](/ops/loop.md)). A subagent starts with nothing but its
brief, so the brief decides how well it works.

* **[E]** Subagents run on Sonnet with high effort while the weekly limit of
  the larger model is used up; the main agent prepares each task so that
  this model can do it well (owner, 2026-11-18).
* **[E]** The main agent learns from the results, changes the next briefs
  and records the experience here (owner, 2026-11-18).

## What a brief contains

A brief is complete when a reader without this conversation could do the
task. These parts were needed every time:

1. **The state.** The branch, its head commit, the pull request if one
   exists, and what an earlier agent already did or left unchecked.
2. **The decisions.** Where the owner's „Geklärt“ comments are, and that
   they are binding. A text or value the owner has not decided is never
   invented: the subagent stops that part and reports 3 to 5 options.
3. **What changed on main.** Each merged pull request the branch has to
   take in, named with what it moved. An old branch fails on exactly these.
4. **The steps, in order,** as a numbered list, each with the file or the
   command it concerns.
5. **The checks,** each named with its command, and the ones the CI runs
   instead.
6. **The rules that are easy to break,** stated every time (see below).
7. **The report.** The fields the main agent needs: head commit, what was
   done, every [V], the checks with their results, open questions.

One brief holds one task on one branch. Two tasks in one brief worked only
when the second built on the first.

## Rules to state in every brief

* Commit early and push often: a restart or a usage limit ends an agent
  without warning, and unpushed work is hard to recover.
* A local branch name can be taken by another worktree. Check out under a
  new local name and push with `git push origin HEAD:<branch>`.
* Never force push, never amend a pushed commit, never use `--no-verify`,
  never push to main, open no pull request.
* Never lower a mutation floor, never weaken or skip a test.
* `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome`
  for Playwright, never `playwright install`, `--trace off`, a unique
  `E2E_RUN` value for the data folder and an own `E2E_PORT` above 1024
  (three ports from it downwards), so runs of two agents do not wait for
  each other.
* `size-ratchet.json` equals the real line count of `src/client/main.ts`
  and is never above the limit on main.
* A new per-round setting is one entry of the registry with its own order
  number; the brief names the numbers other open branches already took.
* Stop after two failed attempts at the same problem and report.

## What went wrong, and what the brief says since

| Seen | Cause | Since then |
|---|---|---|
| A local Stryker run said 100 %, the CI 93 %. | The machine was loaded by other agents; a test that times out counts as a killed mutant. | The brief says not to trust a score from a run with timeouts. At most two agents run. |
| Full unit test runs failed with timeouts in files the branch did not touch. | Several Stryker and E2E runs at once on four cores. | At most two agents; a file that timed out is run again alone and named in the report. |
| The work and the report of an agent were lost. | A restart or a usage limit before the push. | „Commit early and push often“ in every brief; the main agent reads the branch, not only the report. |
| An agent built a feature the owner had ordered for later. | The brief named the issue but not its „when to build“ decision. | The main agent reads all „Geklärt“ comments before it starts an agent. |
| An agent invented German texts. | The brief asked for a feature that needs texts, without a source for them. | The brief says which texts are decided and that the others are reported as [V] with their exact wording. |
| The CI Gate was red right after a pull request was opened. | Setting a label cancels the first run. | The newer run counts; the main agent checks which jobs were cancelled. |
| An E2E test failed with a strict-mode error. | `getByLabel` matches a part of a longer label. | The brief asks for `{ exact: true }` where one label contains another. |
| Every pull request failed the mutation gate at a file it did not touch. | A floor of 100 % was recorded from a partial run; a mutant survived on main. | A small patch to main first; the brief tells agents not to fix it on their branch. |
| An E2E test failed only on the phone project. | A fleet of an earlier test still flew to the position the test used. | Test data take a position no other spec uses; the cause is searched before a job is run again. |
| A merge of main lost no code but left a red guard test. | Main had gained a catalog entry that needed an article. | The brief lists what each merged pull request added and which guards react to it. |
| An E2E test failed about once in 20 runs with an error toast nobody caused. | The client sent an action by itself, and the server refused it because the player had just lost the right. | Found by logging the requests of the page in the failing test; such actions are sent `quiet` (#301). |
| Agents waited minutes for each other's E2E run. | All runs used the same three ports. | `E2E_PORT` moves them; every brief gives an own value. |

## Open

* Whether the briefs are detailed enough for Sonnet is measured only by a
  few tasks so far: on 2026-11-18 four tasks on Sonnet with high effort
  (an article with a merge check, two old branches brought up to date, one
  follow-up) came back complete, with pushed intermediate states and with
  an untrustworthy mutation run recognised and repeated. New work from
  scratch on Sonnet is not tried yet. [U]
