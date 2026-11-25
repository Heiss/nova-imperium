---
type: log-entry
date: 2026-11-24T11:30
kind: Code
issues: [387, 147]
---

The release pull request changes only the metadata files and runs no expensive job (#387, part 1; owner, 2026-11-23 and 2026-11-24). „Detect changes“ of `ci.yml` refuses any other file in a pull request with the head `release/…` and gives it no code, image, mutation or website job; the CI Gate refuses an expensive job there. The draft with its cheap run, „Ready for review“ with the full run, `release-ready.yml` and the label `voller-lauf` of #147 are gone, and the mutation shards no longer have a complete run of their own for a release pull request (the nightly run keeps the weights). The workflow „Release pull request“ creates a release pull request of `main` only when it is started by hand; a push to `main` rebuilds an open one. It is created as a draft and marked ready by the same run, and stays a draft only while another release branch holds its version or a released hotfix is not merged back [V]. The push of a release merge takes over the proofs of the green push run of its parent when it changes only `VERSION`, `CHANGELOG.md` and `changes/` (`scripts/already-tested.ts`); `src/test/release-metadata.test.ts` lists every file that names them. Open [U]: the strict Trivy scan of a release of `main`, and what only the first release after the merge can show.
