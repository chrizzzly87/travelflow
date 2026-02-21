import { useState } from 'react';

export const useTripAdminOverrideState = () => {
    const [adminOverrideEnabled, setAdminOverrideEnabled] = useState(false);

    return {
        adminOverrideEnabled,
        setAdminOverrideEnabled,
    };
};
