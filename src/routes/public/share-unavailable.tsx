import { createFileRoute } from '@tanstack/react-router';
import { ShareUnavailablePage } from '../../../pages/ShareUnavailablePage';
export const Route = createFileRoute("/_public/{-$locale}/share-unavailable")({ component: ShareUnavailablePage });
