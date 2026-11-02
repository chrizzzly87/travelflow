export const AI_REASONING_EFFORTS = [
  'none',
  'minimal',
  'low',
  'medium',
  'high',
  'xhigh',
  'max',
] as const;

export type AiReasoningEffort = typeof AI_REASONING_EFFORTS[number];

export const isAiReasoningEffort = (value: unknown): value is AiReasoningEffort => (
  typeof value === 'string' && AI_REASONING_EFFORTS.includes(value as AiReasoningEffort)
);

const REASONING_EFFORT_RANK = new Map(
  AI_REASONING_EFFORTS.map((effort, index) => [effort, index]),
);

export const resolveSupportedReasoningEffort = (
  requested: AiReasoningEffort,
  supportedEfforts?: AiReasoningEffort[],
  reasoningMandatory = false,
): AiReasoningEffort | undefined => {
  const allowedEfforts = (supportedEfforts?.length ? supportedEfforts : AI_REASONING_EFFORTS)
    .filter((effort) => !reasoningMandatory || effort !== 'none');

  if (allowedEfforts.length === 0) {
    return undefined;
  }
  if (allowedEfforts.includes(requested)) {
    return requested;
  }

  const requestedRank = REASONING_EFFORT_RANK.get(requested) ?? 0;
  return [...allowedEfforts].sort((left, right) => {
    const leftRank = REASONING_EFFORT_RANK.get(left) ?? 0;
    const rightRank = REASONING_EFFORT_RANK.get(right) ?? 0;
    const distanceDifference = Math.abs(leftRank - requestedRank) - Math.abs(rightRank - requestedRank);
    return distanceDifference || leftRank - rightRank;
  })[0];
};
