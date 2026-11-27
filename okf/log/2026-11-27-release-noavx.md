---
type: log-entry
date: 2026-11-27T21:36
kind: Code
issues: [456, 449]
---

The release checks its image on a CPU without AVX too (#456, follow-up of #449): before „latest“ and „stable“ move, a job starts the pushed amd64 image by digest under QEMU with the CPU model Denverton on a fresh volume and waits for `/healthz`; a failure stops the aliases, like the Trivy scan. The step is `scripts/release-noavx.sh`, tested with stubs; the real release was not run for it (see [Docker](/architecture/docker.md)).
