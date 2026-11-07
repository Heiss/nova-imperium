---
type: Specification
title: Round, administration and sign-in update
description: Requirements and verification checklist for the combined release pull request.
---

# To do

- [x] Round setup: let an administrator independently enable achievements and daily rewards when resetting the round. Persist the selections, enforce them server-side and reset reward progress.
- [x] Player navigation: show a small red exclamation mark for completed construction and research, finished ship or defense orders, claimable rewards, unread messages, relevant fleet changes and pending guild applications.
- [x] Admin tabs: separate event log, players, orders, invitations, universe and announcements. Fetch data only when its area opens.
- [x] Audit log: retain the search filters, default to the latest 10 results and offer 10, 25, 50 and 100 per page, with first, previous, next and last controls.
- [x] Server announcement: send plain text to all current inboxes and through Web Push to opted-in devices. Audit the send.
- [x] Password change: require matching new-password fields and reject mismatches on the server.
- [x] Sign-in: verify the email-code path for new sign-ins, offer an explicit persistent sign-in choice, and make passkey registration available from account options.
- [x] PWA: explain how to install from supported browsers and how to enable notifications for the instance and device.

# Release gate

Run local checks and the full GitHub CI Gate, then merge the combined pull request.

The persistent sign-in choice retains the authenticated session on that browser.
A fresh password sign-in still requires the configured email code. A passkey is
an independent sign-in method and requires user verification.
