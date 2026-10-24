interface GenerationRequestIdentity {
    tripId?: string | null;
    requestId?: string | null;
}

// Generation and trip controls share this registry even when their modules load
// independently. It deliberately has no dependency on prompt or provider code.
const controllersByTrip = new Map<string, AbortController>();
const controllersByRequest = new Map<string, AbortController>();

const normalizeId = (value: string | null | undefined): string => (
    typeof value === 'string' ? value.trim() : ''
);

export const registerActiveGenerationAbortController = (
    context: GenerationRequestIdentity | undefined,
    controller: AbortController | null,
): (() => void) => {
    if (!controller) return () => {};

    const registrations: Array<[Map<string, AbortController>, string]> = [
        [controllersByTrip, normalizeId(context?.tripId)],
        [controllersByRequest, normalizeId(context?.requestId)],
    ];

    for (const [registry, id] of registrations) {
        if (!id) continue;
        const previous = registry.get(id);
        if (previous && previous !== controller) previous.abort('superseded');
        registry.set(id, controller);
    }

    return () => {
        for (const [registry, id] of registrations) {
            // A completed request must never unregister its replacement.
            if (id && registry.get(id) === controller) registry.delete(id);
        }
    };
};

export const abortActiveTripGenerationRequest = (
    params: GenerationRequestIdentity & { reason?: string },
): boolean => {
    const requestId = normalizeId(params.requestId);
    const tripId = normalizeId(params.tripId);
    const controller = (requestId && controllersByRequest.get(requestId))
        || (tripId && controllersByTrip.get(tripId));
    if (!controller) return false;
    controller.abort(normalizeId(params.reason) || 'user_abort');
    return true;
};
