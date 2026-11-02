import { createFileRoute, redirect } from '@tanstack/react-router';
export const Route = createFileRoute("/_redirects/trip")({ beforeLoad: () => { throw redirect({ href: "/create-trip", replace: true }); } });
