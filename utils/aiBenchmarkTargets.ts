export interface AiBenchmarkTargetModel {
    id: string;
    provider: string;
    model: string;
    label: string;
}

export interface AiBenchmarkRunTarget {
    provider: string;
    model: string;
    label?: string;
}

export interface AiBenchmarkTargetReference {
    id: string;
}

export const toggleInactiveBenchmarkTargetId = (inactiveTargetIds: string[], modelId: string): string[] => {
    if (inactiveTargetIds.includes(modelId)) {
        return inactiveTargetIds.filter((entry) => entry !== modelId);
    }
    return [...inactiveTargetIds, modelId];
};

export const pruneInactiveBenchmarkTargetIds = (
    inactiveTargetIds: string[],
    allowedTargetIds: Iterable<string>
): string[] => {
    const allowed = new Set(allowedTargetIds);
    return inactiveTargetIds.filter((entry) => allowed.has(entry));
};

export const buildRunnableBenchmarkTargets = (
    selectedTargets: AiBenchmarkTargetModel[],
    inactiveTargetIds: Iterable<string>
): AiBenchmarkRunTarget[] => {
    const inactiveSet = new Set(inactiveTargetIds);
    return selectedTargets
        .filter((target) => !inactiveSet.has(target.id))
        .map((target) => ({
            provider: target.provider,
            model: target.model,
            label: target.label,
        }));
};

export const getAllSelectedBenchmarkTargetIds = (
    selectedTargets: Iterable<AiBenchmarkTargetReference>
): string[] => {
    const seen = new Set<string>();
    const orderedIds: string[] = [];
    for (const target of selectedTargets) {
        if (!target.id || seen.has(target.id)) continue;
        seen.add(target.id);
        orderedIds.push(target.id);
    }
    return orderedIds;
};
