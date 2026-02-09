import { useEffect, useState } from 'react';
import { getAllTrips } from '../services/storageService';

export const useHasSavedTrips = (): boolean => {
    const [hasTrips, setHasTrips] = useState(() => getAllTrips().length > 0);

    useEffect(() => {
        const check = () => setHasTrips(getAllTrips().length > 0);

        window.addEventListener('storage', check);
        window.addEventListener('tf:trips-updated', check);
        return () => {
            window.removeEventListener('storage', check);
            window.removeEventListener('tf:trips-updated', check);
        };
    }, []);

    return hasTrips;
};
