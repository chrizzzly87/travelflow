import { createFileRoute, redirect } from '@tanstack/react-router';
export const Route = createFileRoute("/_redirects/create-trip/labs/journey-architect")({ beforeLoad: () => { throw redirect({ href: "/create-trip", replace: true }); } });
