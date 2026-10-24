import type { AnyRouter } from '@tanstack/react-router';

/** Native routing owns capture/commit timing. Read the preference on every
 * navigation, including in browsers without typed view-transition support. */
export function configurePageTransitions(router: AnyRouter) {
    return router.subscribe('onBeforeNavigate', ({ fromLocation, pathChanged }) => {
        router.update({
            defaultViewTransition: Boolean(fromLocation && pathChanged && typeof window !== 'undefined'
                && window.matchMedia && !window.matchMedia('(prefers-reduced-motion: reduce)').matches),
        });
    });
}
