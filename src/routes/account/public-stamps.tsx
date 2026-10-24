import { createFileRoute } from '@tanstack/react-router';
import { PublicProfileStampsPage } from '../../../pages/PublicProfileStampsPage';
export const Route = createFileRoute("/_client/u/$username/stamps")({ component: PublicProfileStampsPage });
