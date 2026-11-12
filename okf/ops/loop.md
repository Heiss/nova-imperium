---
type: process
title: Release loop
description: How Claude works through a release with /loop - plan with the owner, clarify, build, make the release pull request ready, stop.
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
  order: finish the own open pull request, make the release ready (all
  issues of the milestone closed), plan the release (no open milestone),
  clarify the next issue, build it (owner, 2026-11-12). Releasing needs an
  open milestone, so a closed one never triggers it again.
* **[V]** Questions to the owner are asked with the question tool inside the
  iteration; the iteration waits for the answer and continues with it. An
  issue counts as clarified when it has a comment that starts with
  `Geklärt` and lists the decisions with the OKF link.
* **[E]** The loop asks the owner first what a release should bring, with
  proposals from the open issues; **infrastructure first**, features after
  it (owner, 2026-11-12). The chosen issues form the milestone
  `next release`.
* **[E]** When every issue of the milestone is closed and the release pull
  request is green with its candidate image, the loop tells the owner and
  **stops**. The owner merges the release pull request; that is the release
  (owner, 2026-11-12, [Branching and release](/ops/branching-release.md)).
* **[E]** The rules of the project stay as they are: ask instead of
  assuming, 3 to 5 options per decision, merges under O4, one own pull
  request at a time, never a merge of a release pull request.
* **[V]** Guards from loop engineering practice: a stop condition a machine
  can check (milestone closed, release pull request green), the state read
  fresh in every iteration, small reviewable steps, tests never weakened,
  and a hand-back to the owner after two failed attempts at one problem.
* **[V]** While the loop waits on CI or a review it wakes every 20 to 30
  minutes; GitHub events of subscribed pull requests wake it earlier.
* **[U]** Milestones are managed through the GitHub tools of the session;
  whether they can set a milestone on an issue is checked in the first
  planning iteration.
