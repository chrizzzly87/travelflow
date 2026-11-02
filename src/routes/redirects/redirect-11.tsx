import { createFileRoute, redirect } from '@tanstack/react-router';
export const Route = createFileRoute("/_redirects/create-trip/v3")({ beforeLoad: () => { throw redirect({ href: "/create-trip/wizard", replace: true, statusCode: 301 }); } });
