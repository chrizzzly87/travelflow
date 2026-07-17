---
id: rel-2026-07-16-trip-shape-thailand-foundation
version: v0.157.0
title: "Thailand trip-shape planning foundation"
date: 2026-07-16
published_at: 2026-07-16T20:00:00Z
status: draft
notify_in_app: false
in_app_hours: 24
summary: "A hidden route-first planner now compares trusted Thailand trip concepts before opening an editable map and timeline."
---

## Changes
- [ ] [Internal] 🧭 Added a hidden five-step trip-shape flow for city breaks, one-base day trips, and Thailand circuits.
- [ ] [Internal] 🗺️ Added canonical cities and neighborhoods with immediate, explainable route comparison and an editable plan handoff.
- [ ] [Internal] 🇹🇭 Added a versioned Thailand knowledge pack with 84 canonical places, 321 sourced facts, 420 evidence-aware tags, localized route templates, and activity coverage for every required route base.
- [ ] [Internal] ⚡ Added deterministic route matching, sourced transfer ranges, and instant knowledge-enriched trips so the first useful answer no longer waits for itinerary generation.
- [ ] [Internal] 🧾 Added a visible fast-path receipt with retrieval time, payload size, dataset version, selected catalogue counts, and AI-call count.
- [ ] [Internal] 🏛️ Added category-aware hours, pricing, duration, booking, weather, effort, access, facilities, audience, freshness, and source fields for eight researched activities without inventing missing data.
- [ ] [Internal] 🗂️ Added a searchable admin catalogue for published places, facts, tags, templates, source evidence, freshness, and honest rich/usable/starter coverage gaps alongside the review queue.
- [ ] [Internal] ⏱️ Added cached country-knowledge indexes, browser-visible stage latency telemetry, dataset-safe route reveals, and repeatable CPU performance guardrails for every supported trip shape.
- [ ] [Internal] 📚 Added compact destination briefs and an instant route preview with sourced city guidance, ranked neighborhoods and activities, signature dishes, seasonal context, and evidence-aware audience signals.
- [ ] [Internal] 🔎 Preserved canonical entity IDs, recommendation origin, source keys, rank scores, and compiler versions on the editable plan for reproducible planning and quality diagnostics.
- [ ] [Internal] 🔄 Defined the licensed source, crawl, review, versioning, publish, freshness, and rollback pipeline for continuously maintained country knowledge.
- [ ] [Internal] 🧾 Deployed an admin-only source-run and review ledger, registered 17 governed sources, and added build-blocking plus weekly freshness, expiry, license, and registry-drift checks before enabling crawlers.
- [ ] [Internal] 📥 Added guarded GeoNames and Wikidata ingestion with private immutable source snapshots, deterministic identity matching, and review-only change candidates.
- [ ] [Internal] ✅ Added an admin review queue with source evidence, structured value comparisons, and atomic accept, edit, reject, or request-changes decisions that cannot publish data directly.
- [ ] [Internal] 📦 Added deterministic reviewed-data artifacts with guarded staging, atomic activation, immutable history, and version-pointer rollback.
- [ ] [Internal] 🗓️ Added a monthly dry-run-first identity refresh that remains read-only until dedicated TravelFlow database secrets are configured.
- [ ] [Internal] 🛡️ Backed up the existing production data, deployed the isolated travel-knowledge schema and Thailand pack, verified row parity and RLS, and enabled remote reads only on the test branch.
- [ ] [Internal] 🧩 Added a reusable map presentation contract and routed the live trip workspace through validated marker, route, selection, and viewport scene layers separated from product state.
- [ ] [Internal] 🚦 Added a default-off rollout that can promote the route-first planner on the wizard surface first, then on both production creator entries without changing their URLs.
- [ ] [Internal] 🔍 Added canonical city and neighborhood search across primary, local, and alternate place names in every active language.
- [ ] [Internal] 🧵 Defined three low-risk JourneySpec sidebar concepts and a shared Journey Ribbon visualization before changing the main trip workspace.
- [ ] [Internal] 🎛️ Added an isolated comparison lab for the Journey Lens, Route Storyboard, and Adaptive Inspector with synchronized city and transfer focus.
- [ ] [Internal] 🧭 Kept the Journey Lens workspace integration default-off after fit testing, with its structure isolated for further concept review.
- [ ] [Internal] 🎨 Scoped the editorial decision-card system to route examples and high-level choices while keeping the working planner visually restrained.
- [ ] [Internal] 🩺 Distinguished exhausted AI-provider quota from generic request failures in generation telemetry and retry diagnostics.
- [ ] [Internal] 🪄 Added optional one-call route adaptation with schema-constrained output, catalogue-only place decisions, review, apply, undo, an explicit adapted-plan state, and a visible model receipt without regenerating the full itinerary.
