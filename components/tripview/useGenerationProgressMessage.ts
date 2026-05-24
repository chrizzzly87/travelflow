import { useEffect, useReducer } from 'react';

interface UseGenerationProgressMessageOptions {
    isActive: boolean;
    messages: readonly string[];
    intervalMs?: number;
}

interface GenerationProgressMessageState {
    index: number;
    message: string;
}

type GenerationProgressMessageAction =
    | { type: 'reset'; message: string }
    | { type: 'advance'; messages: readonly string[]; fallbackMessage: string };

const generationProgressMessageReducer = (
    state: GenerationProgressMessageState,
    action: GenerationProgressMessageAction
): GenerationProgressMessageState => {
    switch (action.type) {
        case 'reset':
            return {
                index: 0,
                message: action.message,
            };
        case 'advance': {
            if (action.messages.length === 0) {
                return {
                    index: 0,
                    message: action.fallbackMessage,
                };
            }
            const nextIndex = (state.index + 1) % action.messages.length;
            return {
                index: nextIndex,
                message: action.messages[nextIndex] ?? action.fallbackMessage,
            };
        }
        default:
            return state;
    }
};

export const useGenerationProgressMessage = ({
    isActive,
    messages,
    intervalMs = 2200,
}: UseGenerationProgressMessageOptions): string => {
    const firstMessage = messages[0] ?? '';
    const [state, dispatch] = useReducer(generationProgressMessageReducer, {
        index: 0,
        message: firstMessage,
    });

    useEffect(() => {
        if (!isActive) {
            dispatch({ type: 'reset', message: firstMessage });
            return;
        }

        dispatch({ type: 'reset', message: firstMessage });
        const timer = window.setInterval(() => {
            dispatch({ type: 'advance', messages, fallbackMessage: firstMessage });
        }, intervalMs);

        return () => window.clearInterval(timer);
    }, [firstMessage, intervalMs, isActive, messages]);

    return state.message;
};
