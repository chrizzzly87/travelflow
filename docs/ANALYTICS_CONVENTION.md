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
| `navigation__{target}` | target = `brand`, `features`, `inspirations`, `updates`, `blog`, `pricing`, `login`, `create_trip`, `my_trips` | — | `SiteHeader.tsx` |
| `mobile_nav__menu--open` | — | — | `MobileMenu.tsx` |
| `mobile_nav__{target}` | same targets as above | — | `MobileMenu.tsx` |

### Home
| Event | Detail | Payload | File |
|-------|--------|---------|------|
| `home__hero_cta--{cta}` | `start_planning`, `see_examples` | — | `HeroSection.tsx` |
| `home__bottom_cta` | — | — | `CtaBanner.tsx` |
| `home__carousel_card` | — | `{ template }` | `ExampleTripsCarousel.tsx` |

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
| `pricing__tier--{name}` | `free` (others disabled) | — | `PricingPage.tsx` |

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

## Adding new events

1. Pick the `page` prefix matching where the element lives.
2. Choose an `element` name that describes the widget.
3. Decide: is the qualifier finite (< ~15 values) and stable? → use `--{detail}`. Otherwise → payload.
4. Add a `trackEvent(...)` call and update the catalog table above.
5. Run `npm run build` — the TypeScript type catches malformed names at compile time.
