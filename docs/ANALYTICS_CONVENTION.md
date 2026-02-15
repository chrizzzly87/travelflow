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
| `example_trip__open` | — | `{ template, country_count }` | `App.tsx` |
| `example_trip__banner--copy_trip` | — | `{ template, country_count }` | `App.tsx` |
| `example_trip__banner--create_similar` | — | `{ template, country_count }` | `App.tsx` |

### Trip Paywall
| Event | Detail | Payload | File |
|-------|--------|---------|------|
| `trip_paywall__strip--activate` | — | `{ trip_id }` | `TripView.tsx` |
| `trip_paywall__overlay--activate` | — | `{ trip_id }` | `TripView.tsx` |
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
| `banner__early_access--dismiss` | — | — | `EarlyAccessBanner.tsx` |

### Features & Pricing
| Event | Detail | Payload | File |
|-------|--------|---------|------|
| `features__bottom_cta` | — | — | `FeaturesPage.tsx` |
| `pricing__tier--{name}` | `backpacker` (others disabled until billing launch) | — | `PricingPage.tsx` |

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
| `auth__queue--fulfilled` | — | `{ request_id }` | `LoginPage.tsx` |
| `auth__queue--failed` | — | `{ request_id }` | `LoginPage.tsx` |
| `auth__state--change` | — | `{ flow_id, attempt_id, auth_event, has_session }` | `AuthContext.tsx` |
| `auth__{step}--{result}` | runtime auth steps (password, oauth, upgrade, logout) | `{ flow_id, attempt_id, provider, error_code }` | `authService.ts` |

### Admin
| Event | Detail | Payload | File |
|-------|--------|---------|------|
| `admin__menu--{target}` | `dashboard`, `ai_benchmark`, `access` | — | `AdminMenu.tsx` |
| `admin__menu--brand` | — | — | `AdminMenu.tsx` |
| `admin__menu--back_to_platform` | — | — | `AdminMenu.tsx` |

### Trip View
| Event | Detail | Payload | File |
|-------|--------|---------|------|
| `trip_view__auth--login` | — | `{ trip_id }` | `TripView.tsx` |
| `trip_view__auth--logout` | — | `{ trip_id }` | `TripView.tsx` |

### Not Found
| Event | Detail | Payload | File |
|-------|--------|---------|------|
| `not_found__view` | — | `{ locale, path }` | `NotFoundPage.tsx` |
| `not_found__cta--plan_yours` | — | `{ locale }` | `NotFoundPage.tsx` |
| `not_found__link--contact` | — | `{ locale }` | `NotFoundPage.tsx` |

### Inspirations
| Event | Detail | Payload | File |
|-------|--------|---------|------|
| `inspirations__destination_card` | — | `{ title, country }` | `InspirationsPage.tsx` |
| `inspirations__festival_card` | — | `{ name, country }` | `InspirationsPage.tsx` |
| `inspirations__getaway_card` | — | `{ title, destination }` | `InspirationsPage.tsx` |
| `inspirations__country_pill` | — | `{ country }` | `InspirationsPage.tsx` |
| `inspirations__quick_pill` | — | `{ label }` | `InspirationsPage.tsx` |
| `inspirations__section--{name}` | `themes`, `months`, `countries`, `festivals`, `weekends` | — | `InspirationsPage.tsx` |
| `inspirations__bottom_cta` | — | — | `InspirationsPage.tsx` |

### App
| Event | Detail | Payload | File |
|-------|--------|---------|------|
| `app__trip--create` | — | `{ city_count, activity_count, travel_segment_count, total_item_count }` | `App.tsx` |
| `app__trip_history--open` | — | `{ source }` | `TripView.tsx` |
| `app__chunk_recovery--reload` | — | `{ module_key, reason }` | `services/lazyImportRecovery.ts` |

### Create Trip
| Event | Detail | Payload | File |
|-------|--------|---------|------|
| `create_trip__cta--generate` | — | `{ destination_count, date_mode, route_lock, round_trip }` | `CreateTripClassicLabPage.tsx` |
| `create_trip__toggle--roundtrip` | — | `{ enabled }` | `CreateTripClassicLabPage.tsx` |
| `create_trip__toggle--route_lock` | — | `{ enabled }` | `CreateTripClassicLabPage.tsx` |
| `create_trip__section--expand` | — | `{ section_id, expanded }` | `CreateTripClassicLabPage.tsx` |

### Create Trip
| Event | Detail | Payload | File |
|-------|--------|---------|------|
| `create_trip__guest_queue--queued` | — | `{ flow, request_id }` | `CreateTripForm.tsx` |
| `create_trip__guest_queue--queue_failed` | — | `{ flow }` | `CreateTripForm.tsx` |
| `create_trip__guest_queue--modal_open` | — | `{ request_id }` | `CreateTripForm.tsx` |
| `create_trip__guest_queue--continue_auth` | — | `{ request_id }` | `CreateTripForm.tsx` |
| `create_trip__guest_queue--dismiss` | — | `{ request_id }` | `CreateTripForm.tsx` |

## Adding new events

1. Pick the `page` prefix matching where the element lives.
2. Choose an `element` name that describes the widget.
3. Decide: is the qualifier finite (< ~15 values) and stable? → use `--{detail}`. Otherwise → payload.
4. Add a `trackEvent(...)` call and update the catalog table above.
5. Run `npm run build` — the TypeScript type catches malformed names at compile time.
