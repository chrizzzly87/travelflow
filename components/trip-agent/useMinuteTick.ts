import { useEffect, useState } from 'react';

const TICK_MS = 60_000;

/** Re-renders once a minute so relative chat timestamps stay truthful. */
export const useMinuteTick = (): number => {
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        const timer = window.setInterval(() => setNow(Date.now()), TICK_MS);
        return () => window.clearInterval(timer);
    }, []);

    return now;
};
