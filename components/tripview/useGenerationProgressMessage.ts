import { useEffect, useState } from 'react';

interface UseGenerationProgressMessageOptions {
    isActive: boolean;
    messages: readonly string[];
    intervalMs?: number;
}

export const useGenerationProgressMessage = ({
    isActive,
    messages,
    intervalMs = 2200,
}: UseGenerationProgressMessageOptions): string => {
    const firstMessage = messages[0] ?? '';
    const [message, setMessage] = useState(firstMessage);

    useEffect(() => {
        if (!isActive) {
            setMessage(firstMessage);
            return;
        }

        let index = 0;
        setMessage(firstMessage);
        const timer = window.setInterval(() => {
            index = (index + 1) % messages.length;
            setMessage(messages[index] ?? firstMessage);
        }, intervalMs);

        return () => window.clearInterval(timer);
    }, [firstMessage, intervalMs, isActive, messages]);

    return message;
};
