/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_MAPS_API_KEY?: string;
  readonly VITE_MAPBOX_ACCESS_TOKEN?: string;
  readonly VITE_MAP_RUNTIME_PRESET?: 'google_all' | 'mapbox_visual_google_services' | 'mapbox_all';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
