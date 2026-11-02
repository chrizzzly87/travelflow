import { createFileRoute } from '@tanstack/react-router';

// The mask must be an explicit root child, with no area component/assets.
// Start's native shell prerender supplies only the shared root and pending UI.
export const Route = createFileRoute('/__offline-shell')({ ssr: false });
