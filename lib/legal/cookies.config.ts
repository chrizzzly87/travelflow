/**
 * Browser Storage Registry - single source of truth.
 *
 * This registry must include every cookie/localStorage/sessionStorage key used by the app.
 * Wildcards are supported using `*` (for example `tf_share_links:*`).
 *
 * When adding browser storage:
 * 1. Add or update the entry here with purpose, duration, provider, and category.
 * 2. Keep cookie policy and privacy disclosures consistent with these entries.
 * 3. For non-essential categories, ensure consent-gated loading is in place.
 */

export type CookieCategory = 'essential' | 'analytics' | 'marketing';

export interface CookieDefinition {
  name: string;
  purpose: string;
  duration: string;
  provider: string;
  storage?: 'cookie' | 'localStorage' | 'sessionStorage';
  storageFallbacks?: Array<'localStorage' | 'sessionStorage'>;
  notes?: string;
}

export type CookieRegistry = Record<CookieCategory, CookieDefinition[]>;

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const matchesRegistryName = (registeredName: string, keyName: string): boolean => {
  if (registeredName === keyName) return true;
  if (!registeredName.includes('*')) return false;
  const pattern = `^${registeredName.split('*').map(escapeRegExp).join('.*')}$`;
  return new RegExp(pattern).test(keyName);
};

export const doesRegistryNameMatch = (registeredName: string, keyName: string): boolean =>
  matchesRegistryName(registeredName, keyName);

export const COOKIE_REGISTRY: CookieRegistry = {
  essential: [
    {
      name: 'tf_cookie_consent_choice_v1',
      purpose: 'Stores the user consent decision for optional analytics.',
      duration: 'Persistent',
      provider: 'TravelFlow',
      storage: 'localStorage',
    },
    {
      name: 'sb-*-auth-token',
      purpose: 'Supabase auth session token for signed-in users.',
      duration: 'Session lifecycle (rotating)',
      provider: 'Supabase Auth',
      storage: 'localStorage',
      storageFallbacks: ['sessionStorage'],
      notes: 'Can also appear in sessionStorage during OAuth edge cases; required for login persistence.',
    },
    {
      name: 'sb-*-refresh-token',
      purpose: 'Supabase refresh token metadata used for renewing sessions.',
      duration: 'Session lifecycle (rotating)',
      provider: 'Supabase Auth',
      storage: 'localStorage',
      storageFallbacks: ['sessionStorage'],
      notes: 'Can also appear in sessionStorage during OAuth edge cases.',
    },
    {
      name: 'sb-*-code-verifier',
      purpose: 'PKCE verifier used during Supabase OAuth callback flows.',
      duration: 'Single OAuth flow',
      provider: 'Supabase Auth',
      storage: 'localStorage',
      storageFallbacks: ['sessionStorage'],
      notes: 'May be stored in sessionStorage by Supabase internals during OAuth handshakes.',
    },
    {
      name: 'tf_auth_return_path_v1',
      purpose: 'Remembers the intended in-app path after successful login.',
      duration: 'Until consumed or cleared',
      provider: 'TravelFlow',
      storage: 'localStorage',
    },
    {
      name: 'tf_auth_pending_redirect_v1',
      purpose: 'Temporary pending redirect context for auth-required flows.',
      duration: 'Up to 30 minutes',
      provider: 'TravelFlow',
      storage: 'localStorage',
    },
    {
      name: 'tf_auth_last_oauth_provider_v1',
      purpose: 'Stores the last OAuth provider to simplify repeated sign-ins.',
      duration: 'Persistent',
      provider: 'TravelFlow',
      storage: 'localStorage',
    },
    {
      name: 'tf_auth_pending_oauth_provider_v1',
      purpose: 'Tracks pending OAuth provider choice during active auth handoff.',
      duration: 'Up to 15 minutes',
      provider: 'TravelFlow',
      storage: 'localStorage',
    },
    {
      name: 'tf_auth_trace_v1',
      purpose: 'Stores recent auth troubleshooting traces for support/debugging.',
      duration: 'Persistent (bounded history)',
      provider: 'TravelFlow',
      storage: 'localStorage',
      notes: 'Used only for local diagnostics and can be cleared any time.',
    },
    {
      name: 'tf_app_language',
      purpose: 'Persists the selected app language/locale.',
      duration: 'Persistent',
      provider: 'TravelFlow',
      storage: 'localStorage',
    },
    {
      name: 'travelflow_trips_v1',
      purpose: 'Stores locally saved trip drafts and metadata.',
      duration: 'Persistent',
      provider: 'TravelFlow',
      storage: 'localStorage',
    },
    {
      name: 'travelflow_history_v1',
      purpose: 'Stores per-trip local navigation/snapshot history.',
      duration: 'Persistent',
      provider: 'TravelFlow',
      storage: 'localStorage',
    },
    {
      name: 'travelflow_offline_sync_queue_v1',
      purpose: 'Stores queued trip edits while Supabase is unavailable so they can sync after reconnect.',
      duration: 'Persistent (bounded queue)',
      provider: 'TravelFlow',
      storage: 'localStorage',
    },
    {
      name: 'travelflow_sync_conflict_backups_v1',
      purpose: 'Stores server-side trip backup snapshots captured before client-wins replay applies.',
      duration: 'Persistent (bounded history)',
      provider: 'TravelFlow',
      storage: 'localStorage',
    },
    {
      name: 'tf_client_error_buffer_v1',
      purpose: 'Stores recent Supabase/client error diagnostics in a bounded local ring buffer.',
      duration: 'Persistent (bounded history)',
      provider: 'TravelFlow',
      storage: 'localStorage',
      notes: 'Debug/support diagnostics only; can be cleared safely.',
    },
    {
      name: 'travelflow_country_cache_v1',
      purpose: 'Caches reverse-geocoded country lookups for trip items.',
      duration: 'Persistent',
      provider: 'TravelFlow',
      storage: 'localStorage',
    },
    {
      name: 'tf_route_cache_v1',
      purpose: 'Caches route calculations to reduce repeat map API requests.',
      duration: 'Up to 24 hours',
      provider: 'TravelFlow',
      storage: 'localStorage',
    },
    {
      name: 'tf_share_links:*',
      purpose: 'Stores per-trip generated share links locally.',
      duration: 'Persistent until revoked/cleared',
      provider: 'TravelFlow',
      storage: 'localStorage',
    },
    {
      name: 'tf_trip_copy_notice',
      purpose: 'Temporary cross-page “trip copied” toast payload.',
      duration: 'Session',
      provider: 'TravelFlow',
      storage: 'sessionStorage',
    },
    {
      name: 'tf_map_style',
      purpose: 'Persists selected map visual style.',
      duration: 'Persistent',
      provider: 'TravelFlow',
      storage: 'localStorage',
    },
    {
      name: 'tf_route_mode',
      purpose: 'Persists selected route rendering mode.',
      duration: 'Persistent',
      provider: 'TravelFlow',
      storage: 'localStorage',
    },
    {
      name: 'tf_layout_mode',
      purpose: 'Persists selected planner layout mode.',
      duration: 'Persistent',
      provider: 'TravelFlow',
      storage: 'localStorage',
    },
    {
      name: 'tf_timeline_view',
      purpose: 'Persists selected timeline orientation.',
      duration: 'Persistent',
      provider: 'TravelFlow',
      storage: 'localStorage',
    },
    {
      name: 'tf_timeline_mode',
      purpose: 'Persists selected timeline mode (calendar or timeline list).',
      duration: 'Persistent',
      provider: 'TravelFlow',
      storage: 'localStorage',
    },
    {
      name: 'tf_city_names',
      purpose: 'Persists map label visibility preference for city names.',
      duration: 'Persistent',
      provider: 'TravelFlow',
      storage: 'localStorage',
    },
    {
      name: 'tf_zoom_level',
      purpose: 'Persists preferred map zoom level.',
      duration: 'Persistent',
      provider: 'TravelFlow',
      storage: 'localStorage',
    },
    {
      name: 'tf_sidebar_width',
      purpose: 'Persists planner sidebar width preference.',
      duration: 'Persistent',
      provider: 'TravelFlow',
      storage: 'localStorage',
    },
    {
      name: 'tf_timeline_height',
      purpose: 'Persists planner timeline panel height preference.',
      duration: 'Persistent',
      provider: 'TravelFlow',
      storage: 'localStorage',
    },
    {
      name: 'tf_details_width',
      purpose: 'Persists details panel width preference.',
      duration: 'Persistent',
      provider: 'TravelFlow',
      storage: 'localStorage',
    },
    {
      name: 'tf_map_preview_state_v1',
      purpose: 'Persists floating map preview mode, snapped position, size preset, and orientation.',
      duration: 'Persistent',
      provider: 'TravelFlow',
      storage: 'localStorage',
    },
    {
      name: 'tf_country_amount',
      purpose: 'Persists country info currency converter amount input.',
      duration: 'Persistent',
      provider: 'TravelFlow',
      storage: 'localStorage',
    },
    {
      name: 'tf_country_dir',
      purpose: 'Persists country info currency converter direction.',
      duration: 'Persistent',
      provider: 'TravelFlow',
      storage: 'localStorage',
    },
    {
      name: 'tf_country_info_expanded',
      purpose: 'Legacy country info panel UI state key (cleanup compatibility).',
      duration: 'Legacy cleanup only',
      provider: 'TravelFlow',
      storage: 'localStorage',
    },
    {
      name: 'tf_release_notice_dismissed_release_id',
      purpose: 'Stores last dismissed in-app release notice.',
      duration: 'Persistent',
      provider: 'TravelFlow',
      storage: 'localStorage',
    },
    {
      name: 'tf_locale_suggestion_dismissed_session',
      purpose: 'Session-level dismissal state for locale suggestion banner.',
      duration: 'Session',
      provider: 'TravelFlow',
      storage: 'sessionStorage',
    },
    {
      name: 'tf_locale_suggestion_switched',
      purpose: 'Stores acknowledgement that user accepted locale switch suggestion.',
      duration: 'Persistent',
      provider: 'TravelFlow',
      storage: 'localStorage',
    },
    {
      name: 'tf_translation_notice_dismissed_session',
      purpose: 'Session-level dismissal state for translation warning banner.',
      duration: 'Session',
      provider: 'TravelFlow',
      storage: 'sessionStorage',
    },
    {
      name: 'tf_early_access_dismissed',
      purpose: 'Stores dismissal state for early-access marketing banner.',
      duration: 'Persistent',
      provider: 'TravelFlow',
      storage: 'localStorage',
    },
    {
      name: 'tf_admin_sidebar_collapsed_v1',
      purpose: 'Persists admin sidebar collapse preference.',
      duration: 'Persistent',
      provider: 'TravelFlow',
      storage: 'localStorage',
    },
    {
      name: 'tf_dev_admin_bypass_disabled',
      purpose: 'Session flag to disable dev-admin bypass after explicit logout in the current tab.',
      duration: 'Session',
      provider: 'TravelFlow',
      storage: 'sessionStorage',
      notes: 'Debug-only session control; does not store account profile data.',
    },
    {
      name: 'admin.users.cache.v1',
      purpose: 'Caches admin users table data to reduce repeat fetches.',
      duration: 'Persistent (refreshable cache)',
      provider: 'TravelFlow',
      storage: 'localStorage',
    },
    {
      name: 'admin.trips.cache.v1',
      purpose: 'Caches admin trips table data to reduce repeat fetches.',
      duration: 'Persistent (refreshable cache)',
      provider: 'TravelFlow',
      storage: 'localStorage',
    },
    {
      name: 'admin.audit.cache.v1',
      purpose: 'Caches admin audit log table data to reduce repeat fetches.',
      duration: 'Persistent (refreshable cache)',
      provider: 'TravelFlow',
      storage: 'localStorage',
    },
    {
      name: 'admin.user_changes.cache.v1',
      purpose: 'Caches admin user change log data to reduce repeat fetches.',
      duration: 'Persistent (refreshable cache)',
      provider: 'TravelFlow',
      storage: 'localStorage',
    },
    {
      name: 'admin.tiers.counts.v1',
      purpose: 'Caches admin tier count summaries.',
      duration: 'Persistent (refreshable cache)',
      provider: 'TravelFlow',
      storage: 'localStorage',
    },
    {
      name: 'admin.tiers.preview.v1',
      purpose: 'Caches admin tier reapply preview snapshots.',
      duration: 'Persistent (refreshable cache)',
      provider: 'TravelFlow',
      storage: 'localStorage',
    },
    {
      name: 'tf_debug_simulated_login',
      purpose: 'Stores simulated login debug toggle for local testing.',
      duration: 'Persistent',
      provider: 'TravelFlow',
      storage: 'localStorage',
      notes: 'Debug-only key; not used for production user profiling.',
    },
    {
      name: 'tf_debug_supabase_connectivity_override',
      purpose: 'Stores forced Supabase connectivity mode (offline/degraded/online) for outage simulation.',
      duration: 'Persistent',
      provider: 'TravelFlow',
      storage: 'localStorage',
      notes: 'Debug-only key.',
    },
    {
      name: 'tf_debug_browser_connectivity_override',
      purpose: 'Stores forced browser online/offline mode for network simulation in debugger testing.',
      duration: 'Persistent',
      provider: 'TravelFlow',
      storage: 'localStorage',
      notes: 'Debug-only key.',
    },
    {
      name: 'tf_debug_trip_expired_overrides_v1',
      purpose: 'Stores debug overrides for trip expiry simulation.',
      duration: 'Persistent',
      provider: 'TravelFlow',
      storage: 'localStorage',
      notes: 'Debug-only key; can be removed without affecting user data.',
    },
    {
      name: 'tf_debug_db',
      purpose: 'Stores local debug toggle for database diagnostics.',
      duration: 'Persistent',
      provider: 'TravelFlow',
      storage: 'localStorage',
      notes: 'Debug-only key.',
    },
    {
      name: 'tf_debug_auto_open',
      purpose: 'Stores on-page debugger auto-open preference.',
      duration: 'Persistent',
      provider: 'TravelFlow',
      storage: 'localStorage',
      notes: 'Debug-only key.',
    },
    {
      name: 'tf_debug_tracking_enabled',
      purpose: 'Stores on-page debugger tracking overlay toggle.',
      duration: 'Persistent',
      provider: 'TravelFlow',
      storage: 'localStorage',
      notes: 'Debug-only key.',
    },
    {
      name: 'tf_debug_panel_expanded',
      purpose: 'Stores on-page debugger expanded/collapsed state.',
      duration: 'Persistent',
      provider: 'TravelFlow',
      storage: 'localStorage',
      notes: 'Debug-only key.',
    },
    {
      name: 'tf_debug_h1_highlight',
      purpose: 'Stores on-page debugger heading-highlight toggle.',
      duration: 'Persistent',
      provider: 'TravelFlow',
      storage: 'localStorage',
      notes: 'Debug-only key.',
    },
    {
      name: 'tf_debug_prefetch_section_expanded',
      purpose: 'Stores debugger prefetch diagnostics section expansion state.',
      duration: 'Persistent',
      provider: 'TravelFlow',
      storage: 'localStorage',
      notes: 'Debug-only key.',
    },
    {
      name: 'tf_debug_view_transition_section_expanded',
      purpose: 'Stores debugger view-transition diagnostics section expansion state.',
      duration: 'Persistent',
      provider: 'TravelFlow',
      storage: 'localStorage',
      notes: 'Debug-only key.',
    },
    {
      name: 'tf_debug_prefetch_overlay',
      purpose: 'Stores debugger prefetch overlay toggle.',
      duration: 'Persistent',
      provider: 'TravelFlow',
      storage: 'localStorage',
      notes: 'Debug-only key.',
    },
    {
      name: 'tf_lazy_chunk_recovery:*',
      purpose: 'Prevents repeated reload loops after lazy chunk load failures.',
      duration: 'Session',
      provider: 'TravelFlow',
      storage: 'sessionStorage',
      notes: 'Dynamic key suffix is module-specific.',
    },
    {
      name: 'tf_connectivity_banner_dismissed_state_v1',
      purpose: 'Stores per-session dismissal state for outage/connectivity planner banner.',
      duration: 'Session',
      provider: 'TravelFlow',
      storage: 'localStorage',
      storageFallbacks: ['sessionStorage'],
    },
  ],
  analytics: [
    {
      name: 'umami.disabled',
      purpose: 'Optional local opt-out flag read by Umami to disable analytics tracking in this browser.',
      duration: 'Persistent (only if manually set)',
      provider: 'Umami (self-hosted)',
      storage: 'localStorage',
      notes: 'Current Umami runtime does not create umami.cache.',
    },
  ],
  marketing: [],
};

export const getCookiesByCategory = (category: CookieCategory): CookieDefinition[] =>
  COOKIE_REGISTRY[category];

export const getAllCookies = (): CookieDefinition[] => [
  ...COOKIE_REGISTRY.essential,
  ...COOKIE_REGISTRY.analytics,
  ...COOKIE_REGISTRY.marketing,
];

export const isCookieRegistered = (cookieName: string): boolean =>
  getAllCookies().some((cookie) => matchesRegistryName(cookie.name, cookieName));

export const getCookieByName = (cookieName: string): CookieDefinition | undefined =>
  getAllCookies().find((cookie) => matchesRegistryName(cookie.name, cookieName));

export const getCookieCategoryByName = (cookieName: string): CookieCategory | null => {
  const categories: CookieCategory[] = ['essential', 'analytics', 'marketing'];
  for (const category of categories) {
    if (COOKIE_REGISTRY[category].some((cookie) => matchesRegistryName(cookie.name, cookieName))) {
      return category;
    }
  }
  return null;
};

export const validateCookieRegistry = (): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  const allCookies = getAllCookies();
  const seen = new Set<string>();

  allCookies.forEach((cookie) => {
    if (!cookie.name) {
      errors.push('Cookie/storage entry is missing name');
      return;
    }
    if (seen.has(cookie.name)) {
      errors.push(`Duplicate cookie/storage name found: ${cookie.name}`);
    }
    seen.add(cookie.name);
    if (!cookie.purpose) errors.push(`Entry ${cookie.name} is missing purpose`);
    if (!cookie.duration) errors.push(`Entry ${cookie.name} is missing duration`);
    if (!cookie.provider) errors.push(`Entry ${cookie.name} is missing provider`);
    if (!cookie.storage) errors.push(`Entry ${cookie.name} is missing storage medium`);
    if (cookie.storage === 'cookie' && cookie.storageFallbacks && cookie.storageFallbacks.length > 0) {
      errors.push(`Entry ${cookie.name} cannot define storageFallbacks when storage is cookie`);
    }
    if (cookie.storage && cookie.storage !== 'cookie' && cookie.storageFallbacks?.includes(cookie.storage)) {
      errors.push(`Entry ${cookie.name} has duplicate storage fallback "${cookie.storage}"`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
};

const isDevRuntime = Boolean((import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV);

if (isDevRuntime) {
  const validation = validateCookieRegistry();
  if (!validation.valid) {
    console.error('[Cookie Registry] Validation errors:', validation.errors);
  }
}
