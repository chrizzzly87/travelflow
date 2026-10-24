import { createFileRoute } from '@tanstack/react-router';
import { PublicProfilePage } from '../../../pages/PublicProfilePage';
export const Route = createFileRoute("/_client/u/$username")({ component: PublicProfilePage });
