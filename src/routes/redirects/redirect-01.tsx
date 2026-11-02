import { createFileRoute, redirect } from '@tanstack/react-router';
export const Route = createFileRoute("/_redirects/admin")({ beforeLoad: () => { throw redirect({ href: "/admin/dashboard", replace: true }); } });
