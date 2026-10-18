import { createFileRoute, Outlet } from '@tanstack/react-router';
import TripWorkspaceLayout from '../../../features/trips/TripWorkspaceLayout';
export const Route = createFileRoute('/_trips')({ ssr: false, component: TripWorkspaceLayout });
