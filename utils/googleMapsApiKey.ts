// --- API KEY MANAGEMENT ---
// NOTE: AI provider keys (e.g. Gemini) must never be read in client code.
// Vite-inlined VITE_* values ship in the public bundle; all AI generation goes
// through the server endpoints instead. Only intentionally-public,
// domain-restricted browser keys belong here.
export const getGoogleMapsApiKey = (): string => {
   return import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
};
