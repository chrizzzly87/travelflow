import { createFileRoute } from '@tanstack/react-router';
import { CreateTripClassicLabPage } from '../../../pages/CreateTripClassicLabPage';
import { CreateTripRoute } from '../../../features/trips/CreateTripRoute';
export const Route = createFileRoute("/_create/create-trip/labs/classic-card")({ component: CreatePage });
function CreatePage() { return <CreateTripRoute Page={CreateTripClassicLabPage} />; }
