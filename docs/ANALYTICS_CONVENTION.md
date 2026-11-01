# Analytics Event Naming Convention

All analytics events use a **BEM-inspired** naming format enforced by a TypeScript template literal type in `services/analyticsService.ts`.

## Format

```
{page}__{element}
{page}__{element}--{detail}
```

| Segment   | Purpose | Examples |
|-----------|---------|----------|
| `page`    | Page or persistent UI region | `home`, `navigation`, `mobile_nav`, `footer`, `features`, `pricing`, `inspirations`, `consent`, `app`, `banner` |
| `element` | Specific widget interacted with | `hero_cta`, `bottom_cta`, `carousel_card`, `destination_card`, `tier`, `menu` |
| `detail`  | *(optional)* Finite qualifier — meaningful action **or** known target | `accept`, `reject`, `dismiss`, `open`, `create`, `themes`, `free` |

## Rules

1. **Clicks are implicit** — never add `--click`. If a user taps a card, the event is just `inspirations__destination_card`, not `inspirations__destination_card--click`.
2. **Use `--{detail}` only for finite, known qualifiers:**
   - Actions that differentiate: `consent__banner--accept` vs `consent__banner--reject`
   - Known navigation targets (< ~15 items): `navigation__features`, `footer__privacy`
   - Named tiers/modes: `pricing__tier--free`
3. **Variable / open-ended data goes in the payload**, not the event name. If the set is large or user-generated, keep the event name stable and pass specifics as properties:
   ```ts
   trackEvent('inspirations__destination_card', { title: 'Backpacking Southeast Asia', country: 'Thailand' });
   ```
4. **Use `snake_case`** within each segment, separated by `__` and `--`.
5. **Prefix grouping** — all events from a page share the same prefix (`inspirations__*`), making dashboard filtering trivial.
6. **Do not use URL query parameters as analytics tracking** when Umami event tracking is available. Track intent with `trackEvent(...)` and payload properties instead.
7. **`getAnalyticsDebugAttributes(...)` is for QA/debug overlays only.** It does not replace `trackEvent(...)`.

## Locale switch tracking guidance

- For locale switches (`header select`, `mobile select`, `language suggestion banner`), prefer `trackEvent(...)` payload properties such as:
  - `source` (for example `language_banner`, `header_select`, `mobile_menu`)
  - `from`, `to`
  - `target` (localized path)
- Avoid appending UTM-style query params to internal route switches solely for analytics attribution.
- Keep attribution in Umami events and payload fields so URLs stay clean/canonical-safe.

## When to use payload vs `--detail`

| Set size | Example | Approach |
|----------|---------|----------|
| Small & stable (< ~15) | Nav links, footer links, pricing tiers, sections | `--{detail}` in event name |
| Large or open-ended | Destinations, festivals, countries, user content | Stable event name + payload |
| No meaningful qualifier | Bottom CTA, generic actions | Two-part name only |

## Filtering in Umami

| Question | Dashboard filter |
|----------|-----------------|
| All inspirations activity | Events starting with `inspirations__` |
| All destination card clicks | Event = `inspirations__destination_card` |
| Which countries get clicked most? | Event = `inspirations__destination_card`, group by `country` payload property |
| Japan clicks specifically? | Event = `inspirations__destination_card`, property `country` = `Japan` |

## Current event catalog

### Navigation
| Event | Detail | Payload | File |
|-------|--------|---------|------|
| `navigation__{target}` | target = `brand`, `features`, `inspirations`, `updates`, `blog`, `pricing`, `login`, `logout`, `admin`, `create_trip`, `my_trips` | — | `SiteHeader.tsx` |
| `mobile_nav__menu--open` | — | — | `MobileMenu.tsx` |
| `mobile_nav__{target}` | same targets as above | — | `MobileMenu.tsx` |

### Home
| Event | Detail | Payload | File |
|-------|--------|---------|------|
| `home__hero_cta--{cta}` | `start_planning`, `see_examples` | — | `HeroSection.tsx` |
| `home__bottom_cta` | — | — | `CtaBanner.tsx` |
| `home__carousel_card` | — | `{ template }` | `ExampleTripsCarousel.tsx` |
| `home__carousel_cta--inspirations` | — | — | `ExampleTripsCarousel.tsx` |

### Example Trips
| Event | Detail | Payload | File |
|-------|--------|---------|------|
| `example_trip__open` | — | `{ template, country_count }` | `routes/ExampleTripLoaderRoute.tsx` |
| `example_trip__banner--copy_trip` | — | `{ template, country_count }` | `routes/ExampleTripLoaderRoute.tsx` |
| `example_trip__banner--create_similar` | — | `{ template, country_count }` | `routes/ExampleTripLoaderRoute.tsx` |

### Trip Paywall
| Event | Detail | Payload | File |
|-------|--------|---------|------|
| `trip_paywall__strip--activate` | — | `{ trip_id, activation_mode }` | `TripView.tsx` |
| `trip_paywall__overlay--activate` | — | `{ trip_id, activation_mode }` | `TripView.tsx` |
| `trip_paywall__overlay--faq` | — | `{ trip_id }` | `TripView.tsx` |

### Consent
| Event | Detail | Payload | File |
|-------|--------|---------|------|
| `consent__banner--accept` | — | `{ source }` | `CookieConsentBanner.tsx` |
| `consent__banner--reject` | — | `{ source }` | `CookieConsentBanner.tsx` |
| `consent__page--accept` | — | `{ source }` | `CookiesPage.tsx` |
| `consent__page--reject` | — | `{ source }` | `CookiesPage.tsx` |

### Footer & Banners
| Event | Detail | Payload | File |
|-------|--------|---------|------|
| `footer__{target}` | `imprint`, `privacy`, `terms`, `cookies` | — | `SiteFooter.tsx` |

### Features & Pricing
| Event | Detail | Payload | File |
|-------|--------|---------|------|
| `features__bottom_cta` | — | — | `FeaturesPage.tsx` |
| `pricing__tier--{name}` | `backpacker` (others disabled until billing launch) | — | `PricingPage.tsx` |
| `pricing__plan_cta--{state}` | `loading`, `current`, `upgrade`, `manage_billing`, `downgrade_manage` | `{ tier, current_tier }` | `PricingPage.tsx` |

### Auth
| Event | Detail | Payload | File |
|-------|--------|---------|------|
| `auth__page--view` | — | `{ has_claim }` | `LoginPage.tsx` |
| `auth__modal--open` | — | `{ source }` | `AuthModal.tsx` |
| `auth__modal--close` | — | `{ source, reason }` | `AuthModal.tsx` |
| `auth__modal--success` | — | `{ source }` | `AuthModal.tsx` |
| `auth__redirect--resume` | — | `{ source, next_path, current_path }` | `LoginModalContext.tsx` |
| `auth__callback--received` | — | `{ has_claim }` | `LoginPage.tsx` |
| `auth__callback--error` | — | `{ has_claim }` | `LoginPage.tsx` |
| `auth__method--select` | `login`, `register`, `google`, `apple`, `facebook` | `{ source? }` | `LoginPage.tsx`, `AuthModal.tsx` |
| `auth__password--{mode}` | `login`, `register` | — | `LoginPage.tsx` |
| `auth__password_reset--request` | — | `{ source, intent }` | `LoginPage.tsx`, `AuthModal.tsx` |
| `auth__password_reset--requested` | — | `{ source, intent }` | `LoginPage.tsx`, `AuthModal.tsx` |
| `auth__password_reset--failed` | — | `{ source, intent }` | `LoginPage.tsx`, `AuthModal.tsx` |
| `auth__password_reset_page--view` | — | `{ has_error, has_recovery_context }` | `ResetPasswordPage.tsx` |
| `auth__password_reset--back_login` | — | — | `ResetPasswordPage.tsx` |
| `auth__password_update--submit` | — | — | `ResetPasswordPage.tsx` |
| `auth__password_update--blocked` | — | `{ reason }` | `ResetPasswordPage.tsx` |
| `auth__password_update--failed` | — | — | `ResetPasswordPage.tsx` |
| `auth__password_update--success` | — | — | `ResetPasswordPage.tsx` |
| `auth__queue--fulfilled` | — | `{ request_id }` | `LoginPage.tsx` |
| `auth__queue--failed` | — | `{ request_id }` | `LoginPage.tsx` |
| `auth__state--change` | — | `{ flow_id, attempt_id, auth_event, has_session }` | `AuthContext.tsx` |
| `auth__{step}--{result}` | runtime auth steps (password, oauth, upgrade, logout) | `{ flow_id, attempt_id, provider, error_code }` | `authService.ts` |

### Admin
Every admin screen uses `admin__<screen>--<action>` (or `admin__<screen>_<area>--<action>` for a
sub-surface such as a row menu or a sheet). One row per surface; the actions are listed.

| Event prefix | Actions | Payload | File |
|-------|--------|---------|------|
| `admin__menu--` | `{nav item id}` (e.g. `users`, `ai_telemetry`), `brand`, `search`, `collapse_toggle` | `{ collapsed }` on `collapse_toggle` | `components/admin/AdminShell.tsx` |
| `admin__account--` | `open`, `profile`, `settings`, `app_home`, `create_trip`, `logout` | — | `components/admin/AdminAccountMenu.tsx` |
| `admin__command--` | `{nav item id}`, `theme`, `app_home` | — | `components/admin/AdminCommandMenu.tsx` |
| `admin__theme--toggle` | — | `{ to }` | `components/ui/ThemeToggle.tsx` (surface `admin`) |
| `admin__dashboard--` | `all_users`, `recent_user`, `failed_generations`, `expiring_trips` | — | `pages/AdminDashboardPage.tsx` |
| `admin__users--` | `create_user`, `export_csv`, `more_filters`, `reset_filters` | — | `pages/AdminUsersPage.tsx`, `components/admin/users/UsersFilterBar.tsx`, `components/admin/users/useAdminUsersActions.ts` |
| `admin__users_queue--` | `awaiting_activation`, `subscriptions_at_risk`, `empty_accounts` | — | `components/admin/users/UsersQueueTiles.tsx` |
| `admin__users_row--` | `copy_id`, `view_trips` | — | `components/admin/users/UsersTableRow.tsx`, `components/admin/users/useAdminUsersActions.ts` |
| `admin__users_detail--tab` | — | `{ tab }` | `components/admin/users/UserDetailSheet.tsx` |
| `admin__trips_kpi--filter` | — | `{ kpi }` | `pages/AdminTripsPage.tsx` |
| `admin__trips_bulk--` | `archive`, `delete` | `{ count }` | `pages/AdminTripsPage.tsx` |
| `admin__trips_selection--select_all_matching` | — | `{ count }` | `pages/AdminTripsPage.tsx` |
| `admin__trips_owner--open_user`, `admin__trips_sheet--open_owner` | — | — | `pages/AdminTripsPage.tsx` |
| `admin__tiers--` | `save`, `reapply` | `{ tier_key }` | `pages/AdminTiersPage.tsx` (Plans screen) |
| `admin__billing--` | `reconcile`, `review_failed`, `review_unlinked` | — | `pages/AdminBillingPage.tsx` |
| `admin__billing_view--switch` | — | `{ view }` | `pages/AdminBillingPage.tsx` |
| `admin__billing_subscription--`, `admin__billing_event--` | `details`, `open_user`, `reconcile` | — | `components/admin/AdminBillingSheets.tsx` |
| `admin__audit--` | `export_replay`, `export_selected`, `export_entry`, `reset_filters`, `open_entry`, `open_actor`, `open_target`, `show_diff`, `undo`, `copy_action_code`, `open_in_users`, `open_in_trips`, `open_trip`, `open_owner`, `restore_user` | — | `pages/AdminAuditPage.tsx` |
| `admin__airports--` | `tab`, `new_airport`, `open_airport`, `save_airport`, `create_airport`, `delete_airport`, `sync`, `bulk_edit`, `bulk_apply`, `bulk_delete`, `select_all_matching`, `reset_filters` | `{ tab }` on `tab` | `pages/AdminAirportsPage.tsx` |
| `admin__destinations--` | `select`, `save`, `reset_override`, `view`, `reset_filters`, `open_page` | — | `pages/AdminDestinationsPage.tsx` |
| `admin__recommendations--` | `select`, `new`, `save`, `publish_now`, `delete`, `import_bundled`, `reset_filters`, `country` | — | `pages/AdminRecommendationsPage.tsx` |
| `admin__legal_terms--` | `publish`, `set_current`, `use_as_basis`, `discard_draft` | `{ rollout }` on `publish`/`set_current` | `pages/AdminLegalTermsPage.tsx` |
| `admin__settings--` | `save`, `discard` | — | `pages/AdminGlobalSettingsPage.tsx` |
| `admin__ai_benchmark--` | `run`, `stop`, `export`, `new_session`, `delete_session`, `open_run`, `reset_filters`, `show_unrated`, `add_models`, `run_single`, `app_default_model`, `open_telemetry` | `{ source }`, `{ include_logs }` | `pages/AdminAiBenchmarkPage.tsx` |
| `admin__ai_benchmark_run--` | `rate`, `rerun`, `download`, `abort`, `open_trip`, `save_note` | `{ rating }` on `rate` | `components/admin/AiBenchmarkRunSheet.tsx` |
| `admin__ai_telemetry--` | `worker_health`, `reset_filters`, `trend_tab`, `breakdown_tab`, `leader`, `focus_provider` | — | `pages/AdminAiTelemetryPage.tsx` |
| `admin__worker_health--` | `ai_telemetry`, `reset_filters` | — | `pages/AdminAiWorkerHealthPage.tsx` |
| `admin__og_tools--` | `tab`, `inspect`, `copy_command`, `load_trip` | `{ tab }`, `{ source }`, `{ command }` | `pages/AdminOgToolsPage.tsx` |
| `admin__design_playground--open` | — | — | `pages/AdminDesignSystemPlaygroundPage.tsx` |
| `admin__design_playground_component_group--view` | — | `{ group_id }` | `pages/AdminDesignSystemPlaygroundPage.tsx` |
| `admin__design_playground_toast--trigger` | — | `{ scenario_id }` | `pages/AdminDesignSystemPlaygroundPage.tsx` |
| `admin__component_playground--open` | — | — | `pages/AdminComponentPlaygroundPage.tsx` |

### Trip View
| Event | Detail | Payload | File |
|-------|--------|---------|------|
| `trip_view__auth--login` | — | `{ trip_id }` | `TripView.tsx` |
| `trip_view__auth--logout` | — | `{ trip_id }` | `TripView.tsx` |
| `trip_view__admin_override--toggle` | — | `{ trip_id, enabled }` | `TripView.tsx` |
| `trip_view__admin_owner--open_users` | — | `{ trip_id, owner_id }` | `TripView.tsx` |
| `trip_view__mode--calendar` | — | `{ trip_id }` | `TripView.tsx` |
| `trip_view__mode--timeline` | — | `{ trip_id }` | `TripView.tsx` |
| `trip_view__layout_direction--horizontal` | — | `{ trip_id, target }` | `TripView.tsx`, `ItineraryMap.tsx` |
| `trip_view__layout_direction--vertical` | — | `{ trip_id, target }` | `TripView.tsx`, `ItineraryMap.tsx` |
| `trip_view__zoom` | — | `{ trip_id, direction, timeline_mode }` | `TripView.tsx` |
| `trip_view__map_preview--minimize` | — | `{ trip_id, layout_mode }` | `TripView.tsx` |
| `trip_view__map_preview--maximize` | — | `{ trip_id, layout_mode }` | `TripView.tsx` |
| `trip_view__map_preview--reposition` | — | `{ trip_id }` | `TripViewPlannerWorkspace.tsx` |
| `trip_view__timeline_city--open` | — | `{ trip_id, city_id }` | `TripTimelineListView.tsx` |
| `trip_view__timeline_activity--open` | — | `{ trip_id, item_id, city_id }` | `TripTimelineListView.tsx` |
| `trip_view__timeline_transfer--open` | — | `{ trip_id, item_id, city_id, mode }` | `TripTimelineListView.tsx` |
| `trip_view__calendar_export--activity` | — | `{ trip_id, source, item_id, event_count }` | `TripView.tsx` |
| `trip_view__calendar_export--activities` | — | `{ trip_id, source, event_count }` | `TripView.tsx` |
| `trip_view__calendar_export--cities` | — | `{ trip_id, source, event_count }` | `TripView.tsx` |
| `trip_view__calendar_export--all` | — | `{ trip_id, source, event_count }` | `TripView.tsx` |
| `trip_view__my_maps_export` | — | `{ trip_id, place_count, skipped_count }` | `useGoogleMyMapsActions.ts` |
| `trip_view__my_maps_import--load` | — | `{ trip_id, origin, place_count }` | `GoogleMyMapsPanel.tsx` |
| `trip_view__my_maps_import--add` | — | `{ trip_id, origin, place_count, added_count, unlocated_count }` | `GoogleMyMapsPanel.tsx` |
| `trip_view__my_maps_import--error` | — | `{ trip_id, origin, code }` | `GoogleMyMapsPanel.tsx` |
| `trip_view__my_maps_import--open_ideas` | — | `{ trip_id }` | `GoogleMyMapsPanel.tsx` |
| `trip_view__map_idea_markers--toggle` | — | `{ trip_id, active }` | `TripView.tsx` |
| `trip_view__idea_review--keep` | — | `{ trip_id, recommendation_id }` | `TripDiscoverOverlay.tsx` |
| `trip_view__idea_review--skip` | — | `{ trip_id, recommendation_id }` | `TripDiscoverOverlay.tsx` |

### Trip Agent
| Event | Detail | Payload | File |
|-------|--------|---------|------|
| `trip_agent__launcher--open` | — | `{ trip_id, locked, context_count }` | `TripView.tsx` |
| `trip_agent__panel--close` | — | `{ trip_id }` | `TripAgentPanel.tsx` |
| `trip_agent__prompt--submit` | — | `{ trip_id, thread_id, context_count }` | `TripAgentPanel.tsx` |
| `trip_agent__thread--create` | — | `{ trip_id }` | `TripAgentPanel.tsx` |
| `trip_agent__thread--archive` | — | `{ trip_id, thread_id }` | `TripAgentPanel.tsx` |
| `trip_agent__proposal--apply` | — | `{ trip_id, change_set_id, operation_count }` | `TripAgentProposalCard.tsx` |
| `trip_agent__proposal--reject` | — | `{ trip_id, change_set_id }` | `TripAgentProposalCard.tsx` |
| `trip_agent__proposal--revert` | — | `{ trip_id, change_set_id }` | `TripAgentProposalCard.tsx` |
| `trip_agent__context--add` | — | `{ trip_id, context_kind }` | `TripAgentPanel.tsx` |
| `trip_agent__preset--select` | — | `{ trip_id }` | `TripAgentPanel.tsx` |
| `trip_agent__message--retry` | — | `{ trip_id, thread_id, context_count }` | `TripAgentPanel.tsx` |

### Profile
| Event | Detail | Payload | File |
|-------|--------|---------|------|
| `profile__hero_cta--inspirations_country` | — | `{ country }` | `ProfilePage.tsx` |
| `profile__summary--edit_profile` | — | — | `ProfilePage.tsx` |
| `profile__summary--view_public_profile` | — | — | `ProfilePage.tsx` |
| `profile__summary--view_public_profile_setup` | — | — | `ProfilePage.tsx` |
| `profile__trip_visibility--public` | — | `{ trip_id, tab }` | `ProfilePage.tsx` |
| `profile__trip_visibility--private` | — | `{ trip_id, tab }` | `ProfilePage.tsx` |
| `profile__trip_visibility--batch_toggle` | — | `{ tab, selected_count }` | `ProfilePage.tsx` |
| `profile__trip_favorite--batch_toggle` | — | `{ tab, selected_count }` | `ProfilePage.tsx` |
| `profile__trip_archive--single` | — | `{ trip_id, tab }` | `ProfilePage.tsx` |
| `profile__trip_archive--batch` | — | `{ trip_id, tab }` | `ProfilePage.tsx` |
| `profile__trip_select--visible` | — | `{ tab, selected_count }` | `ProfilePage.tsx` |
| `profile__trip_select--expired` | — | `{ tab, selected_count }` | `ProfilePage.tsx` |
| `profile__trip_select--examples` | — | `{ tab, selected_count }` | `ProfilePage.tsx` |
| `profile__trip_select--end` | — | `{ tab }` | `ProfilePage.tsx` |
| `my_trips__trip_archive--single` | — | `{ trip_id }` | `TripManager.tsx` |
| `public_profile__view` | — | `{ username }` | `PublicProfilePage.tsx` |
| `public_profile__trip--open` | — | `{ username, trip_id }` | `PublicProfilePage.tsx` |
| `profile_settings__username_check--{state}` | `available`, `taken`, `reserved`, `invalid`, `unchanged`, `cooldown` | `{ username }` | `ProfileSettingsPage.tsx` |
| `profile_settings__username_edit--open` | — | — | `ProfileSettingsPage.tsx` |
| `profile_settings__username_edit--blocked_cooldown` | — | — | `ProfileSettingsPage.tsx` |
| `profile_settings__save--attempt` | — | `{ mode, username_changed, public_profile_enabled, default_public_trip_visibility }` | `ProfileSettingsPage.tsx` |
| `profile_settings__public_profile--{state}` | `enabled`, `disabled` | — | `ProfileSettingsPage.tsx` |
| `profile_settings__default_visibility--{state}` | `enabled`, `disabled` | — | `ProfileSettingsPage.tsx` |
| `profile_settings__public_url--open` | — | — | `ProfileSettingsPage.tsx` |
| `profile_settings__country_region--select` | — | `{ country_code }` | `ProfileSettingsPage.tsx` |
| `profile_settings__billing--{action}` | `manage`, `cancel` | — | `ProfileSettingsPage.tsx` |
| `public_profile__summary--open_passport` | — | — | `PublicProfilePage.tsx` |
| `trip_preview_card__creator_handle` | — | `{ creator_handle, trip_id }` | `ProfileTripCard.tsx` |
| `example_trip__creator_handle` | — | `{ creator_handle }` | `ExampleTripCard.tsx` |

### Checkout
| Event | Detail | Payload | File |
|-------|--------|---------|------|
| `checkout__page--view` | — | `{ tier, source, has_claim, transaction_present, authenticated }` | `CheckoutPage.tsx` |
| `checkout__auth_tab--{mode}` | `login`, `register` | `{ tier, source }` | `CheckoutPage.tsx` |
| `checkout__auth--{mode}` | `login`, `register` | — | `CheckoutPage.tsx` |
| `checkout__payment--{state}` | `start`, `refresh` | `{ tier, source, from_trip }` | `CheckoutPage.tsx` |
| `checkout__upgrade--{state}` | `confirm`, `success`, `failed`, `manage_billing` | `{ from_tier?, to_tier?, source }` | `CheckoutPage.tsx` |
| `checkout__manage_billing--{target}` | `open`, `cancel` | `{ tier, source }` | `CheckoutPage.tsx` |
| `checkout__traveler_details--{action}` | `edit`, `save` | `{ tier, source }` | `CheckoutPage.tsx` |
| `checkout__success_cta--{target}` | `trip`, `return_trip`, `create_trip`, `profile` | `{ tier, source }` | `CheckoutPage.tsx` |
| `checkout__claim_trip--{state}` | `start`, `success`, `failed` | `{ tier, source }` | `CheckoutPage.tsx` |

### Trip Connectivity
| Event | Detail | Payload | File |
|-------|--------|---------|------|
| `trip_connectivity__banner--dismiss` | — | `{ connectivity_state, pending_count }` | `ConnectivityStatusBanner.tsx` |
| `trip_connectivity__banner--retry_sync` | — | `{ connectivity_state, pending_count, failed_count }` | `ConnectivityStatusBanner.tsx` |
| `trip_connectivity__banner--contact` | — | `{ connectivity_state, pending_count }` | `ConnectivityStatusBanner.tsx` |
| `trip_connectivity__trip_strip--retry_sync` | — | `{ trip_id, connectivity_state, pending_count, failed_count }` | `TripViewStatusBanners.tsx` |
| `trip_connectivity__trip_strip--restore_backup` | — | `{ trip_id }` | `TripViewStatusBanners.tsx` |

### Not Found
| Event | Detail | Payload | File |
|-------|--------|---------|------|
| `not_found__view` | — | `{ locale, path }` | `NotFoundPage.tsx` |
| `not_found__cta--plan_yours` | — | `{ locale }` | `NotFoundPage.tsx` |
| `not_found__link--contact` | — | `{ locale }` | `NotFoundPage.tsx` |

### Contact
| Event | Detail | Payload | File |
|-------|--------|---------|------|
| `contact__form--submit` | — | `{ reason, sub_reason, locale, has_user, source }` | `ContactPage.tsx` |
| `contact__form--success` | — | `{ reason, sub_reason, locale, has_user, status, source }` | `ContactPage.tsx` |
| `contact__form--failed` | — | `{ reason, sub_reason, locale, has_user, status, error_type, source }` | `ContactPage.tsx` |
| `contact__fallback--email` | — | `{ reason, sub_reason, locale, has_user, status, error_type, source }` | `ContactPage.tsx` |
| `contact__faq_item--open` | — | `{ item_id, section_id, source }` | `ContactPage.tsx` |
| `contact__faq_item--close` | — | `{ item_id, section_id, source }` | `ContactPage.tsx` |
| `contact__faq_link--item` | — | `{ item_id, section_id, source }` | `ContactPage.tsx` |
| `contact__faq_link--full_page` | — | `{ source }` | `ContactPage.tsx` |

### FAQ
| Event | Detail | Payload | File |
|-------|--------|---------|------|
| `faq__view` | — | `{ locale, hash }` | `FaqPage.tsx` |
| `faq__section_link` | — | `{ section_id, source }` | `FaqPage.tsx` |
| `faq__item--open` | — | `{ item_id, section_id, source }` | `FaqPage.tsx` |
| `faq__item--close` | — | `{ item_id, section_id, source }` | `FaqPage.tsx` |
| `faq__cta--contact` | — | `{ source }` | `FaqPage.tsx` |

### Inspirations
| Event | Detail | Payload | File |
|-------|--------|---------|------|
| `inspirations__destination_card` | — | `{ title?, country, destination?, kind?, month?, season? }` | `InspirationsPage.tsx`, `CountryExplorerCard.tsx`, `DestinationGuideView.tsx` |
| `inspirations__country_search` | — | `{ query_length, result_count }` | `CountryExplorerControls.tsx` |
| `inspirations__country_month` | — | `{ month }` (`0` = any month) | `CountryExplorerControls.tsx` |
| `inspirations__country_filter` | — | `{ facet, value }` | `CountryExplorerControls.tsx` |
| `inspirations__country_filter--reset` | — | — | `CountryExplorerControls.tsx` |
| `inspirations__country_sort` | — | `{ sort }` | `CountryExplorerControls.tsx` |
| `inspirations__destination_plan` | — | `{ country, destination, kind }` | `DestinationGuideView.tsx` |
| `inspirations__country_route` | — | `{ route_id, country, style, duration_days, stop_count }` | `CountryRouteCards.tsx` |
| `inspirations__festival_card` | — | `{ name, country }` | `InspirationsPage.tsx` |
| `inspirations__festival_card--guide` | — | `{ name, country, region, precision }` | `FestivalCalendarCard.tsx` |
| `inspirations__festival_plan` | — | `{ name, country, region, precision }` | `FestivalCalendarCard.tsx` |
| `inspirations__festival_source` | — | `{ name, country, region, precision }` | `FestivalCalendarCard.tsx` |
| `inspirations__festival_filter--region` | — | `{ region }` | `FestivalsPage.tsx` |
| `inspirations__festival_filter--month` | — | `{ month }` | `FestivalsPage.tsx` |
| `inspirations__getaway_card` | — | `{ title, destination }` | `InspirationsPage.tsx` |
| `inspirations__country_pill` | — | `{ country }` | `InspirationsPage.tsx` |
| `inspirations__quick_pill` | — | `{ label }` | `InspirationsPage.tsx` |
| `inspirations__section--{name}` | `themes`, `months`, `countries`, `festivals`, `weekends` | — | `InspirationsPage.tsx` |
| `inspirations__bottom_cta` | — | — | `InspirationsPage.tsx` |

### App
| Event | Detail | Payload | File |
|-------|--------|---------|------|
| `app__trip--create` | — | `{ city_count, activity_count, travel_segment_count, total_item_count }` | `features/trips/useTripCreation.ts` |
| `app__trip_history--open` | — | `{ source }` | `TripView.tsx` |
| `app__chunk_recovery--reload` | — | `{ module_key, reason }` | `services/lazyImportRecovery.ts` |

### Create Trip
| Event | Detail | Payload | File |
|-------|--------|---------|------|
| `create_trip__cta--generate` | — | `{ destination_count, date_mode, route_lock, round_trip, provider, model }` | `CreateTripClassicPage.tsx` |
| `create_trip__model--select` | — | `{ provider, model, model_id, is_default }` | `CreateTripClassicPage.tsx` |
| `create_trip__toggle--roundtrip` | — | `{ enabled }` | `CreateTripClassicPage.tsx` |
| `create_trip__toggle--route_lock` | — | `{ enabled }` | `CreateTripClassicPage.tsx` |
| `create_trip__section--expand` | — | `{ section_id, expanded }` | `CreateTripClassicPage.tsx` |
| `create_trip_wizard__branch--select` | — | `{ branch }` | `CreateTripV3Page.tsx` |
| `create_trip_wizard__date_mode--select` | — | `{ mode }` | `CreateTripV3Page.tsx` |
| `create_trip_wizard__traveler--select` | — | `{ traveler_type }` | `CreateTripV3Page.tsx` |
| `create_trip_wizard__transport--toggle` | — | `{ mode, enabled }` | `CreateTripV3Page.tsx` |
| `create_trip_wizard__cta--generate` | — | `{ branch, destination_count, date_mode, traveler_type, transport_override }` | `CreateTripV3Page.tsx` |

### Create Trip
| Event | Detail | Payload | File |
|-------|--------|---------|------|
| `create_trip__ai_request--success` | — | `{ provider, model, status, duration_ms, request_id }` | `aiService.ts` |
| `create_trip__ai_request--failed` | — | `{ provider, model, status, duration_ms, error_code }` | `aiService.ts` |

## Adding new events

1. Pick the `page` prefix matching where the element lives.
2. Choose an `element` name that describes the widget.
3. Decide: is the qualifier finite (< ~15 values) and stable? → use `--{detail}`. Otherwise → payload.
4. Add a `trackEvent(...)` call and update the catalog table above.
5. Run `pnpm build` — the TypeScript type catches malformed names at compile time.

## Consent during asynchronous loading

Never treat consent at the start of an analytics-script download as permission to
send later. Recheck consent after every asynchronous boundary before dispatching
an event/pageview. A pending send must be dropped when optional consent is withdrawn.
Same-page and cross-tab consent changes use `subscribeToConsentChanges`; unsubscribe
when the owning UI/runtime unmounts. Existing event names and debug attributes remain
unchanged when improving the consent controls.
