import { useEffect, useState } from 'react';

import { loadPublicAiRuntimeSettings, type AiRuntimeSettings } from '../services/aiRuntimeSettingsService';

/**
 * The client half of the server's rollout gate
 * (`assertTripAgentAvailable` in `netlify/edge-lib/trip-agent-store.ts`).
 * Both must agree, or the launcher offers a panel the server will refuse.
 */
export const isTripAgentRolledOut = (
    settings: Pick<AiRuntimeSettings, 'tripAgentEnabled' | 'tripAgentAdminPreview'>,
    isAdmin: boolean,
): boolean => settings.tripAgentEnabled === true
    || (settings.tripAgentAdminPreview !== false && isAdmin);

/**
 * Reads the app-wide rollout state, which the app already fetches once and
 * caches, and answers whether this actor may see the Trip Agent launcher.
 * It starts hidden: showing a button that cannot work is worse than a late one.
 */
export const useTripAgentAvailability = (isAdmin: boolean): boolean => {
    const [isAvailable, setIsAvailable] = useState(false);

    useEffect(() => {
        let active = true;
        void loadPublicAiRuntimeSettings()
            .then((settings) => {
                if (active) setIsAvailable(isTripAgentRolledOut(settings, isAdmin));
            })
            .catch(() => {
                if (active) setIsAvailable(false);
            });
        return () => { active = false; };
    }, [isAdmin]);

    return isAvailable;
};
