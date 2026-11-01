import { createFileRoute } from '@tanstack/react-router';
import { CreateTripClassicPage } from '../../../pages/CreateTripClassicPage';
import { CreateTripRoute } from '../../../features/trips/CreateTripRoute';
export const Route = createFileRoute("/_create/{-$locale}/create-trip")({ component: CreatePage });
function CreatePage() { return <CreateTripRoute Page={CreateTripClassicPage} />; }
