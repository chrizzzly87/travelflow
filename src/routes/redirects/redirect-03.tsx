import { createFileRoute, redirect } from '@tanstack/react-router';
export const Route = createFileRoute("/_redirects/create-trip/labs/classic-legacy")({ beforeLoad: () => { throw redirect({ href: "/create-trip", replace: true }); } });
