---
id: rel-2026-06-01-pnpm-supply-chain-hardening
version: v0.122.0
title: "Harden pnpm supply chain policy"
date: 2026-06-01
published_at: 2026-06-01T13:41:00Z
status: published
notify_in_app: false
in_app_hours: 24
summary: "Tightened pnpm workspace dependency policy against newly published and exotic transitive packages."
---

## Changes
- [ ] [Internal] 🔒 Kept the workspace minimum package release age at seven days and blocked exotic transitive dependency sources during installs.
