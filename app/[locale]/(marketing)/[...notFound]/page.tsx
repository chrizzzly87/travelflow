import { notFound } from 'next/navigation';

// Unmatched paths render the localized 404 page with a real 404 status
// (previously the SPA fallback served soft-404s with status 200).
export default function CatchAllNotFound(): never {
    notFound();
}
