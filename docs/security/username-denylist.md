# Username Denylist Source of Truth

## Purpose
This file is the canonical, effective username denylist for backend enforcement.
It mirrors seeded database data in `public.username_reserved_handles` and `public.username_blocked_terms`.

## Effective Username Policy
- Allowed charset: `A-Z`, `a-z`, `0-9`, `_`, `-`
- Length: min `3`, max `40`
- Canonical form: lowercase
- Terms that do not match `^[a-z0-9_-]{3,40}$` are excluded from effective denylist seeds.

## Source Metadata
1. SQL source: `docs/supabase.sql`
2. Extracted at: `2026-03-01T08:30:52.619Z`
3. Reserved table: `public.username_reserved_handles`
4. Blocked table: `public.username_blocked_terms`
5. Categories are persisted in DB for governance/reporting.

## Counts
- Reserved handles (effective): **87**
- Blocked terms (effective): **33**
- Combined unique denylist terms (effective): **120**

## Reserved Handles By Category

### `auth`
Count: **7**

- `auth`
- `login`
- `logout`
- `oauth`
- `register`
- `signin`
- `signup`

### `brand`
Count: **6**

- `tamtam`
- `tamtamapp`
- `travelflow`
- `travelflowapp`
- `travelplanner`
- `tripplanner`

### `finance`
Count: **3**

- `billing`
- `payments`
- `refund`

### `platform`
Count: **19**

- `about`
- `account`
- `accounts`
- `api`
- `blog`
- `careers`
- `contact`
- `cookies`
- `create`
- `imprint`
- `jobs`
- `privacy`
- `profile`
- `profiles`
- `settings`
- `terms`
- `trip`
- `trips`
- `www`

### `security`
Count: **20**

- `admin-support`
- `admin-tamtam`
- `admin_tamtam`
- `adminsupport`
- `compliance`
- `mod`
- `moderator`
- `official`
- `official-team`
- `officialteam`
- `safety`
- `security`
- `tamtam-admin`
- `tamtam_admin`
- `trust`
- `trust-safety`
- `trustandsafety`
- `verification`
- `verified`
- `verify`

### `support`
Count: **21**

- `customer-support`
- `customersupport`
- `help`
- `help-center`
- `help-desk`
- `help-tamtam`
- `help_tamtam`
- `helpcenter`
- `helpdesk`
- `service`
- `support`
- `support-tamtam`
- `support-team`
- `support_tamtam`
- `supportteam`
- `tamtam-help`
- `tamtam-helpdesk`
- `tamtam-support`
- `tamtam_help`
- `tamtam_helpdesk`
- `tamtam_support`

### `system_owner`
Count: **11**

- `admin`
- `administrator`
- `admins`
- `no-reply`
- `noreply`
- `owner`
- `staff`
- `status`
- `statuspage`
- `system`
- `team`

## Blocked Terms By Category

### `hate_speech`
Count: **15**

- `chink` (severity `5`)
- `faggot` (severity `5`)
- `gook` (severity `5`)
- `hitler` (severity `5`)
- `kike` (severity `5`)
- `kkk` (severity `5`)
- `neonazi` (severity `5`)
- `nigga` (severity `5`)
- `nigger` (severity `5`)
- `paki` (severity `5`)
- `retard` (severity `5`)
- `siegheil` (severity `5`)
- `spic` (severity `5`)
- `tranny` (severity `5`)
- `wetback` (severity `5`)

### `scam`
Count: **18**

- `2fa` (severity `3`)
- `airdrop` (severity `3`)
- `binance` (severity `3`)
- `bitcoin` (severity `3`)
- `coinbase` (severity `3`)
- `doubling` (severity `3`)
- `escrow` (severity `3`)
- `ethereum` (severity `3`)
- `freemoney` (severity `3`)
- `giveaway` (severity `3`)
- `investment` (severity `3`)
- `metamask` (severity `3`)
- `mfa` (severity `3`)
- `nft` (severity `3`)
- `otp` (severity `3`)
- `recovery` (severity `3`)
- `token` (severity `3`)
- `wallet` (severity `3`)

## Effective Combined Terms
```text
- 2fa
- about
- account
- accounts
- admin
- admin-support
- admin-tamtam
- admin_tamtam
- administrator
- admins
- adminsupport
- airdrop
- api
- auth
- billing
- binance
- bitcoin
- blog
- careers
- chink
- coinbase
- compliance
- contact
- cookies
- create
- customer-support
- customersupport
- doubling
- escrow
- ethereum
- faggot
- freemoney
- giveaway
- gook
- help
- help-center
- help-desk
- help-tamtam
- help_tamtam
- helpcenter
- helpdesk
- hitler
- imprint
- investment
- jobs
- kike
- kkk
- login
- logout
- metamask
- mfa
- mod
- moderator
- neonazi
- nft
- nigga
- nigger
- no-reply
- noreply
- oauth
- official
- official-team
- officialteam
- otp
- owner
- paki
- payments
- privacy
- profile
- profiles
- recovery
- refund
- register
- retard
- safety
- security
- service
- settings
- siegheil
- signin
- signup
- spic
- staff
- status
- statuspage
- support
- support-tamtam
- support-team
- support_tamtam
- supportteam
- system
- tamtam
- tamtam-admin
- tamtam-help
- tamtam-helpdesk
- tamtam-support
- tamtam_admin
- tamtam_help
- tamtam_helpdesk
- tamtam_support
- tamtamapp
- team
- terms
- token
- tranny
- travelflow
- travelflowapp
- travelplanner
- trip
- tripplanner
- trips
- trust
- trust-safety
- trustandsafety
- verification
- verified
- verify
- wallet
- wetback
- www
```
