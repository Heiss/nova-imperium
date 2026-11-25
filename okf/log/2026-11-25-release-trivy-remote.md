---
type: log-entry
date: 2026-11-25T21:00
kind: Fix
issues: [395]
---

The Trivy scan of the release image reads each platform from the registry. The scan of 79a, made per platform since CodeRabbit on #395, pulled the image of its platform into the docker daemon of the amd64 runner and let Trivy export it from there; for arm64 the export failed („unable to create manifests file: NotFound: content digest … not found“), so the scan of release 26.11.28 never ran, no hole was reported, and `latest` and `stable` did not move. Trivy now reads the image with `--image-src remote --platform`, logged in through the docker config of the login, mounted read-only; no `docker pull`, no docker socket. The scans of `ci.yml` and the security hotfix keep the daemon: they scan images of the runner's own platform.
