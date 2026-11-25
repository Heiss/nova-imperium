---
type: log-entry
date: 2026-11-25T09:30
kind: Decision
---

The owner's decisions on the data exchange between server and browser (2026-11-25), in the new concept [Data exchange and realtime](/architecture/realtime.md): stage 3, that is Server-Sent Events that say something changed, fetches with an ETag, the 4 s poll as a slow fallback and updates in place in the client; HTTP/2 to the browser as a requirement; no buffering of the event route by any proxy, the app sends `X-Accel-Buffering: no`; streams only with a valid session, a maximum per account and in total, a heartbeat; volumetric attacks are the operator's; operator texts for nginx, Apache and Caddy with the pull request of the events, checked by E2E tests through real proxies in the CI. Cobalt27 is rejected: nothing is gained over the standards. Open with options: how the data travel, GraphQL included (O26), the limits (O27), several tabs (O28), the proxies in the CI (O29), and `main` or v3 (O30) ([Open points](/open-points.md)).
