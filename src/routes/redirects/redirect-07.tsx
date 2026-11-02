import { createFileRoute, redirect } from '@tanstack/react-router';
export const Route = createFileRoute("/_redirects/create-trip/labs/design-v2")({ beforeLoad: () => { throw redirect({ href: "/create-trip", replace: true, statusCode: 301 }); } });
