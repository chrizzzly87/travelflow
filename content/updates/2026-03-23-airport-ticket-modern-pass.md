---
id: rel-2026-03-23-airport-ticket-modern-pass
version: v0.106.0
title: "Airport ticket preview polish"
date: 2026-03-23
published_at: 2026-03-23T08:56:28Z
status: published
notify_in_app: false
in_app_hours: 24
summary: "Refines the admin airport ticket lab with a cleaner, more modern boarding-pass preview built around bold route typography."
---

## Changes
- [ ] [Internal] 🎫 Reworked the admin fake boarding pass into a cleaner preview with bold route typography, flatter geometry, and separate horizontal and vertical variants that are easier to reuse in future cards and page sections.
- [ ] [Internal] 🔳 Removed the old stub treatment, tightened the ticket details, aligned the route marker treatment, and added a real QR code block so the preview feels more modern and less busy at smaller sizes.
- [ ] [Internal] 🛫 Kept the deterministic BER testing fallback so the ticket lab still renders a useful preview before the first nearby-airport lookup runs.
