import { z } from 'zod';

import type { TripAgentHotelOption, TripAgentRouteAlternative } from './tripAgent.ts';

/**
 * Structured results a grounded specialist returns.
 *
 * A specialist used to answer in prose, which the planner could only relay as a
 * paragraph. These schemas are what the specialist fills in through its final
 * tool call, so stays arrive as three budget groups and routes as selectable
 * alternatives.
 */

export const tripAgentHotelOptionSchema = z.object({
    id: z.string().trim().min(1).max(160),
    name: z.string().trim().min(1).max(240),
    address: z.string().trim().max(500).default(''),
    budgetGroup: z.enum(['low', 'medium', 'high']),
    /** What the grouping is based on, e.g. "mid-range hotels in this area". */
    budgetBasis: z.string().trim().min(1).max(240),
    placeUrl: z.string().url().max(2_000).optional(),
    rating: z.coerce.number().min(0).max(5).optional(),
    sourceIds: z.array(z.string().trim().min(1).max(160)).max(10).default([]),
});

export const tripAgentHotelResultSchema = z.object({
    cityId: z.string().trim().min(1).max(160),
    options: z.array(tripAgentHotelOptionSchema).min(1).max(9),
});

export const tripAgentRouteAlternativeSchema = z.object({
    id: z.string().trim().min(1).max(160),
    title: z.string().trim().min(1).max(240),
    summary: z.string().trim().min(1).max(1_000),
    affectedStopIds: z.array(z.string().trim().min(1).max(160)).max(30).default([]),
    distanceKm: z.coerce.number().nonnegative().max(100_000).optional(),
    durationHours: z.coerce.number().nonnegative().max(10_000).optional(),
    sourceIds: z.array(z.string().trim().min(1).max(160)).max(10).default([]),
});

export const tripAgentRouteResultSchema = z.object({
    alternatives: z.array(tripAgentRouteAlternativeSchema).min(1).max(3),
});

export type TripAgentHotelResult = z.infer<typeof tripAgentHotelResultSchema>;
export type TripAgentRouteResult = z.infer<typeof tripAgentRouteResultSchema>;

/**
 * Buckets options into the three budget groups the panel renders, capped at
 * three each so one group cannot crowd out the others.
 */
export const groupHotelOptionsByBudget = (
    options: TripAgentHotelResult['options'],
): Record<'low' | 'medium' | 'high', TripAgentHotelOption[]> => {
    const groups: Record<'low' | 'medium' | 'high', TripAgentHotelOption[]> = { low: [], medium: [], high: [] };
    options.forEach((option) => {
        const group = groups[option.budgetGroup];
        if (group.length < 3) group.push({ ...option, sourceIds: option.sourceIds || [] });
    });
    return groups;
};

/** Route alternatives carry no operations yet: applying one is a later slice. */
export const toRouteAlternatives = (
    result: TripAgentRouteResult,
): TripAgentRouteAlternative[] => result.alternatives.map((alternative) => ({
    ...alternative,
    operations: [],
    sourceIds: alternative.sourceIds || [],
}));
