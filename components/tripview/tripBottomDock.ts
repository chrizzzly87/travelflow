// The trip page's bottom-end corner is shared by the "Plan with AI" launcher
// and the floating cards (example-trip banner, view-only notice). Every one of
// them reads its position from here, so the cards' clearance is derived from
// the launcher's real offset and height instead of being guessed per file.
//
// Launcher: bottom max(1rem, safe area) + min-h-11 (2.75rem). Cards stacked
// above it keep a 0.75rem gap: 1rem-or-safe-area + 2.75rem + 0.75rem.
//
// Full literal class strings on purpose — Tailwind only generates classes it
// can find verbatim in the source.

export const TRIP_AGENT_LAUNCHER_POSITION_CLASS = 'bottom-[max(1rem,env(safe-area-inset-bottom))] end-4 min-h-11';

/** Card bottom offset on every breakpoint. */
export const tripDockCardBottomClass = (isAgentLauncherVisible: boolean): string => (
    isAgentLauncherVisible ? 'bottom-[calc(max(1rem,env(safe-area-inset-bottom))+3.5rem)]' : 'bottom-4'
);

/** Card bottom offset from `sm` up, for cards that sit elsewhere on phones. */
export const tripDockCardSmBottomClass = (isAgentLauncherVisible: boolean): string => (
    isAgentLauncherVisible ? 'sm:bottom-[calc(max(1rem,env(safe-area-inset-bottom))+3.5rem)]' : 'sm:bottom-6'
);
