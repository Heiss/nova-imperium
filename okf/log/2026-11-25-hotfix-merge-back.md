---
type: log-entry
date: 2026-11-25T18:00
kind: Decision and code
issues: [402, 403, 413]
---

The merge-back of a released hotfix comes from a branch of its own (owner, 2026-11-25, 111a): the pull request from the hotfix branch itself could neither be updated (the ruleset of `hotfix/**`) nor merged (the ruleset of `main` wants an up-to-date branch and a linear history) once `main` moved (#402, replaced by #403 by hand). `tag.yml` now builds `hotfix-back/<name>`, the current `main` with the hotfix merged in, and opens the pull request from it; `release-pr.yml` builds every open one again after each push to `main`. The hotfix branch is never changed; a conflict stops the job with the files named and leaves the branch and its pull request as they were. `scripts/hotfix-back.sh`; tests in `src/test/hotfix-back.test.ts` (built from `main` and the hotfix, built again after `main` moved, the conflict, no second pull request, the hotfix branch unchanged, counted as merged back after a squash, the two workflows).

The owner (2026-11-25): the automatic merge-back stays for security hotfixes only (118a), and a squashed merge-back is no release (116a). Its push sets `VERSION` of `main` to the hotfix's tag; `release.sh` now ends green with „nothing to tag“ when the tag's commit is on a hotfix branch and the pushed commit is exactly its parent with the hotfix merged in. A release commit of `main` that took a hotfix's version, and the same version from a branch that is no hotfix, stay refused. `release-pr.sh` rebuilds the release pull request of `main` on that push. Tests in `src/test/release-tag.test.ts` (squash green and nothing tagged, merge green as before, the two refusals) and `src/test/release-pr.test.ts`.

The review of pull request #413 (CodeRabbit): the merge commit of `hotfix-back.sh` has the release identity, so it works on a runner without one; `tag.yml` takes the script from `main`, since a hotfix cut from an older release has none; every step of a rebuild fails on its own (a refused push prints no „Rebuilt“); a failed listing of the open pull requests is an error, and the listing asks for every pull request, not the first 30.
