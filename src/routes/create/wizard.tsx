import { createFileRoute } from '@tanstack/react-router';
import { CreateTripV3Page } from '../../../pages/CreateTripV3Page';
import { CreateTripRoute } from '../../../features/trips/CreateTripRoute';
export const Route = createFileRoute("/_create/{-$locale}/create-trip/wizard")({ component: CreatePage });
function CreatePage() { return <CreateTripRoute Page={CreateTripV3Page} />; }
