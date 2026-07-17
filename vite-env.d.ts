/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_MAPS_API_KEY?: string;
  readonly VITE_MAPBOX_ACCESS_TOKEN?: string;
  readonly VITE_MAP_RUNTIME_PRESET?: 'google_all' | 'mapbox_visual_google_services' | 'mapbox_all';
  readonly VITE_CREATE_TRIP_SHAPE_ROLLOUT?: 'off' | 'wizard' | 'primary';
  readonly VITE_TRAVEL_KNOWLEDGE_REMOTE_ENABLED?: 'true' | 'false';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
