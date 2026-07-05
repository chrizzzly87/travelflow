// Router compat layer: react-router-dom's API surface (the subset this app
// uses) implemented on top of next/navigation. App code imports from
// '@/lib/router'; the Next.js tree mounts <NextRouterAdapter>, tests mount
// <MemoryRouter>. See docs/ROUTING_COMPAT.md.

export type {
    Location,
    NavigateFunction,
    NavigateOptions,
    Params,
    To,
} from './context';
export { RouterAdapterContext, RouteBaseContext } from './context';
export { useLocation, useNavigate, useParams, useSearchParams } from './hooks';
export type { SetURLSearchParams } from './hooks';
export {
    Link,
    NavLink,
    Navigate,
    Route,
    RouteBase,
    Routes,
} from './components';
export type { LinkProps, NavLinkProps, NavigateProps, RouteProps } from './components';
export { MemoryRouter } from './memory';
export { setPendingNavigationState } from './locationStore';
