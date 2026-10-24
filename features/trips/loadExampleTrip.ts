import { notFound } from '@tanstack/react-router';
import type { ExampleTripRouteData } from './routeData';

/** Intent preloads and navigation share the router's cache, including the generated preview. */
export async function loadExampleTrip(templateId: string, signal: AbortSignal): Promise<ExampleTripRouteData> {
    const { getExampleTemplateSummary, loadExampleTemplateFactory } = await import('../../data/exampleTripTemplates/runtimeFactory');
    signal.throwIfAborted();
    const factory = await loadExampleTemplateFactory(templateId);
    signal.throwIfAborted();
    if (!factory) throw notFound();
    const now = Date.now();
    const generated = factory(new Date(now).toISOString());
    const summary = getExampleTemplateSummary(templateId);
    const countries = summary?.countries.flatMap(country => country.name ? [country.name] : []) ?? [];
    const view = {
        ...generated.defaultView,
        layoutMode: generated.defaultView?.layoutMode ?? 'horizontal' as const,
        timelineView: generated.defaultView?.timelineView ?? 'horizontal' as const,
        mapStyle: generated.defaultView?.mapStyle ?? 'standard' as const,
        zoomLevel: generated.defaultView?.zoomLevel ?? 1,
    };
    return {
        templateId,
        templateTitle: summary?.title ?? generated.title,
        countries,
        access: null,
        view,
        trip: {
            ...generated,
            createdAt: now, updatedAt: now, isFavorite: false, isExample: true,
            exampleTemplateId: templateId, exampleTemplateCountries: countries,
            sourceKind: 'example', sourceOwnerType: 'system_catalog', sourceOwnerHandle: 'travelflow_examples',
            defaultView: view,
        },
    };
}
