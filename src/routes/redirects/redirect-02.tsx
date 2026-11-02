import { createFileRoute, redirect } from '@tanstack/react-router';
export const Route = createFileRoute("/_redirects/admin/access")({ beforeLoad: () => { throw redirect({ href: "/admin/users", replace: true }); } });
