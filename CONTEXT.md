# TravelFlow Destination Knowledge

TravelFlow's shared language for destination identity, researched planning guidance, and the hierarchy used by inspiration experiences.

## Language

**Destination**:
A place a traveler can select or explore, classified as a country, city, or island.
_Avoid_: Location, place record

**Destination Guide**:
A reviewed, queryable snapshot of practical planning information for one Destination, with explicit provenance and freshness.
_Avoid_: Live travel truth, scraped page, mirror

**Country Guide**:
A Destination Guide that provides country-level defaults and owns zero or more City Guides and Island Guides.
_Avoid_: Parent page

**City Guide**:
A Destination Guide for an urban destination that inherits missing planning signals from its Country Guide.
_Avoid_: City page

**Island Guide**:
A Destination Guide for an island destination that inherits missing planning signals from its Country Guide.
_Avoid_: Island page, country

**Source Link**:
A cleaned external URL with its purpose, review date, and referral status recorded separately.
_Avoid_: Raw link, affiliate URL

**Referral Link**:
A Source Link whose original destination carried referral or campaign attribution, even after those parameters have been removed.
_Avoid_: Tracking link
