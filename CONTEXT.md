# TravelFlow

TravelFlow models a trip as one itinerary that can be presented through several planning views without changing the underlying trip.

## Language

**Trip workspace**:
The application shell that presents one trip and lets the traveler move between complementary views of the same itinerary.
_Avoid_: Trip page mode, planner mode

**Workspace view**:
An additive presentation inside the Trip workspace, such as Overview or Schedule. It does not imply a different saved trip.
_Avoid_: Timeline mode, layout mode

**Overview**:
The established interactive planner presentation that combines the timeline, map, selection, and editing tools.
_Avoid_: Legacy view, old planner

**Schedule**:
A day-based calendar presentation of the itinerary. It does not imply hour-level timing unless trip activities explicitly contain that information.
_Avoid_: Hourly calendar
