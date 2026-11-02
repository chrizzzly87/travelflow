import { useEffect } from 'react';
import { useNavigate } from '../navigation';
import { trackEvent } from '../../services/analyticsService';

const hasModelContext = (): boolean => (
    typeof document !== 'undefined'
    && ('modelContext' in document || (typeof navigator !== 'undefined' && 'modelContext' in navigator))
);

/**
 * Offers TravelFlow's trip-draft tools to WebMCP browser agents. The module is
 * only fetched when the browser has the API, so other visitors pay nothing.
 */
export const useWebMcpBootstrap = (): void => {
    // Stable for the router's lifetime, so the tools register once.
    const navigate = useNavigate();

    useEffect(() => {
        if (!hasModelContext()) return;
        const controller = new AbortController();
        void import('../webmcp/travelFlowWebMcpTools').then(({ registerTravelFlowWebMcpTools }) => {
            if (controller.signal.aborted) return;
            registerTravelFlowWebMcpTools(controller.signal, {
                navigate: (path) => navigate(path),
                onDraftCreated: () => trackEvent('webmcp__create_trip_draft'),
            });
        }).catch(() => {
            // An agent-only convenience; a failed chunk must never affect the page.
        });
        return () => controller.abort();
    }, [navigate]);
};
