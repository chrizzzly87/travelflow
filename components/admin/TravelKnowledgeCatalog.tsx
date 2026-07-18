import React, { useMemo, useState } from 'react';
import {
    BookOpenText,
    Buildings,
    ClockCountdown,
    GitDiff,
    LinkSimple,
    MapPin,
    Path,
    Tag,
} from '@phosphor-icons/react';
import { getAnalyticsDebugAttributes, trackEvent } from '../../services/analyticsService';
import type { TravelKnowledgeLoadSource } from '../../services/travelKnowledgeService';
import {
    getTravelActivityKnowledgeCoverage,
    type TravelActivityCoverageStatus,
} from '../../shared/travelActivityKnowledge';
import {
    TRAVEL_ENTITY_TYPE_VALUES,
    type TravelDestinationPack,
    type TravelEntityCatalogItem,
    type TravelEntityFact,
    type TravelEntityType,
    type TravelTemplateCatalogItem,
} from '../../shared/travelKnowledge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../ui/select';
import { AdminSurfaceCard } from './AdminSurfaceCard';

type CatalogMode = 'entities' | 'templates';
type EntityTypeFilter = 'all' | TravelEntityType;
type ActivityCoverageFilter = 'all' | 'needs_work' | TravelActivityCoverageStatus;
type CatalogSort = 'catalog' | 'coverage_priority' | 'popularity';

interface TravelKnowledgeCatalogProps {
    pack: TravelDestinationPack | null;
    source: TravelKnowledgeLoadSource | null;
    searchValue: string;
    isLoading: boolean;
}

const humanizeToken = (value: string): string => (
    value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
);

const formatTimestamp = (value: string | null | undefined): string => {
    if (!value) return '—';
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? new Date(parsed).toLocaleString() : '—';
};

const formatFactValue = (value: unknown): string => {
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    return JSON.stringify(value);
};

const factSourceUrl = (fact: TravelEntityFact): string | null => (
    typeof fact.metadata.sourceUrl === 'string' ? fact.metadata.sourceUrl : null
);

const entitySearchText = (entity: TravelEntityCatalogItem): string => (
    [
        entity.name,
        entity.localName || '',
        entity.canonicalSlug,
        entity.entityType,
        ...entity.names.map((name) => name.name),
        ...entity.tags.map((tag) => tag.tagKey),
        ...entity.facts.flatMap((fact) => [fact.factKey, formatFactValue(fact.valueJson), fact.sourceKey]),
    ].join(' ').toLowerCase()
);

const templateSearchText = (template: TravelTemplateCatalogItem): string => (
    [
        template.templateKey,
        template.journeyType,
        template.copy.title,
        template.copy.summary,
        ...template.copy.highlights,
        ...template.stops.flatMap((stop) => [stop.entityName, stop.entitySlug, stop.stopRole]),
        ...template.tags.map((tag) => tag.tagKey),
    ].join(' ').toLowerCase()
);

const activityCoverageSortRank = (
    coverage: ReturnType<typeof getTravelActivityKnowledgeCoverage>,
): number => {
    if (!coverage) return 3;
    if (coverage.status === 'starter') return 0;
    if (coverage.status === 'usable') return 1;
    return 2;
};

const EntityCard: React.FC<{
    entity: TravelEntityCatalogItem;
    parentName?: string;
}> = ({ entity, parentName }) => {
    const activityCoverage = getTravelActivityKnowledgeCoverage(entity);
    const sourceKeys = Array.from(new Set([
        ...entity.facts.map((fact) => fact.sourceKey),
        ...entity.tags.map((tag) => tag.sourceKey),
    ])).sort();
    const latestObservedAt = entity.facts.reduce((latest: string | null, fact) => (
        !latest || Date.parse(fact.observedAt) > Date.parse(latest) ? fact.observedAt : latest
    ), null as string | null);

    return (
        <article
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
            style={{ contentVisibility: 'auto', containIntrinsicSize: '460px' }}
        >
            <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">
                            {humanizeToken(entity.entityType)}
                        </span>
                        <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                            {humanizeToken(entity.status)}
                        </span>
                        {activityCoverage ? (
                            <span
                                className="inline-flex rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700"
                                title={`${activityCoverage.missingRequiredFactKeys.length} required and ${activityCoverage.missingRecommendedFactKeys.length} recommended fields missing`}
                            >
                                {humanizeToken(activityCoverage.category)} · {activityCoverage.score}% {activityCoverage.status}
                            </span>
                        ) : null}
                    </div>
                    <h3 className="mt-3 text-lg font-black tracking-tight text-slate-950">{entity.name}</h3>
                    <p className="mt-1 break-all font-mono text-xs text-slate-500">{entity.canonicalSlug}</p>
                    {parentName ? <p className="mt-1 text-xs text-slate-500">Inside {parentName}</p> : null}
                </div>
                <dl className="grid grid-cols-3 gap-2 text-center sm:min-w-64">
                    {[
                        ['Popular', entity.popularityScore],
                        ['Discovery', entity.hiddenGemScore],
                        ['Tourism', entity.tourismIntensityScore],
                    ].map(([label, value]) => (
                        <div key={label} className="rounded-xl bg-slate-50 px-2 py-2">
                            <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
                            <dd className="mt-1 text-base font-black tabular-nums text-slate-900">{value}</dd>
                        </div>
                    ))}
                </dl>
            </header>

            <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-600">
                <span className="inline-flex items-center gap-1 rounded-lg bg-slate-50 px-2.5 py-1.5">
                    <BookOpenText size={14} /> {entity.facts.length} facts
                </span>
                <span className="inline-flex items-center gap-1 rounded-lg bg-slate-50 px-2.5 py-1.5">
                    <Tag size={14} /> {entity.tags.length} tags
                </span>
                <span className="inline-flex items-center gap-1 rounded-lg bg-slate-50 px-2.5 py-1.5">
                    <ClockCountdown size={14} /> {formatTimestamp(latestObservedAt)}
                </span>
                {activityCoverage ? (
                    <span className="inline-flex items-center gap-1 rounded-lg bg-slate-50 px-2.5 py-1.5">
                        <GitDiff size={14} /> {activityCoverage.presentFactKeys.length} planning fields · {activityCoverage.missingRequiredFactKeys.length} required gaps
                    </span>
                ) : null}
            </div>

            <details className="mt-4 border-t border-slate-100 pt-3">
                <summary className="cursor-pointer text-sm font-bold text-slate-800">
                    Inspect facts, tags, and sources
                </summary>
                <div className="mt-3 grid gap-4 xl:grid-cols-2">
                    <section>
                        <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">Facts</h4>
                        <div className="mt-2 space-y-2">
                            {entity.facts.length > 0 ? entity.facts.map((fact) => {
                                const sourceUrl = factSourceUrl(fact);
                                return (
                                    <div key={fact.id || `${fact.factKey}:${fact.sourceKey}`} className="rounded-xl border border-slate-200 p-3 text-xs">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <strong className="text-slate-900">{humanizeToken(fact.factKey)}</strong>
                                            <span className="text-slate-500">{Math.round(fact.confidence * 100)}% · {humanizeToken(fact.reviewStatus)}</span>
                                        </div>
                                        <p className="mt-2 whitespace-pre-wrap break-words leading-relaxed text-slate-700">{formatFactValue(fact.valueJson)}</p>
                                        <div className="mt-2 flex flex-wrap items-center gap-2 text-slate-500">
                                            <span>{fact.sourceKey}</span>
                                            <span>Observed {formatTimestamp(fact.observedAt)}</span>
                                            {fact.validUntil ? <span>Valid until {formatTimestamp(fact.validUntil)}</span> : null}
                                            {sourceUrl ? (
                                                <a
                                                    href={sourceUrl}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="inline-flex items-center gap-1 font-semibold text-accent-700 hover:text-accent-900"
                                                    onClick={() => trackEvent('admin__travel_knowledge_catalog_source--open', {
                                                        entity: entity.canonicalSlug,
                                                        fact: fact.factKey,
                                                        source_key: fact.sourceKey,
                                                    })}
                                                    {...getAnalyticsDebugAttributes('admin__travel_knowledge_catalog_source--open')}
                                                >
                                                    Source <LinkSimple size={12} />
                                                </a>
                                            ) : null}
                                        </div>
                                    </div>
                                );
                            }) : <p className="text-xs text-slate-500">No facts published for this entity.</p>}
                        </div>
                    </section>
                    <section>
                        <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">Tags and evidence</h4>
                        <div className="mt-2 flex flex-wrap gap-2">
                            {entity.tags.length > 0 ? entity.tags.map((tag) => (
                                <span
                                    key={`${tag.tagKey}:${tag.sourceKey}`}
                                    title={`${humanizeToken(tag.evidenceLevel)} evidence · ${tag.sourceKey}`}
                                    className="inline-flex rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-700"
                                >
                                    {humanizeToken(tag.tagKey)} · {Math.round(tag.relevance * 100)}%
                                </span>
                            )) : <span className="text-xs text-slate-500">No tags published for this entity.</span>}
                        </div>
                        <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
                            <strong className="text-slate-800">Source keys</strong>
                            <p className="mt-1 break-words font-mono">{sourceKeys.join(', ') || '—'}</p>
                        </div>
                        {activityCoverage ? (
                            <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600">
                                <strong className="text-slate-800">Structured activity coverage</strong>
                                <dl className="mt-2 grid grid-cols-2 gap-2">
                                    <div><dt>Category</dt><dd className="font-semibold text-slate-900">{humanizeToken(activityCoverage.category)}</dd></div>
                                    <div><dt>Planning tier</dt><dd className="font-semibold text-slate-900">{humanizeToken(activityCoverage.planningTier)}</dd></div>
                                    <div><dt>Expiring in 30 days</dt><dd className="font-semibold text-slate-900">{activityCoverage.expiringFactCount}</dd></div>
                                    <div><dt>Expired</dt><dd className="font-semibold text-slate-900">{activityCoverage.expiredFactCount}</dd></div>
                                </dl>
                                {activityCoverage.missingRequiredFactKeys.length > 0 ? (
                                    <div className="mt-3">
                                        <span className="font-semibold text-rose-700">Missing required</span>
                                        <p className="mt-1 break-words font-mono">{activityCoverage.missingRequiredFactKeys.join(', ')}</p>
                                    </div>
                                ) : null}
                                {activityCoverage.missingRecommendedFactKeys.length > 0 ? (
                                    <div className="mt-3">
                                        <span className="font-semibold text-amber-700">Missing recommended</span>
                                        <p className="mt-1 break-words font-mono">{activityCoverage.missingRecommendedFactKeys.join(', ')}</p>
                                    </div>
                                ) : null}
                                {activityCoverage.invalidFactKeys.length > 0 ? (
                                    <div className="mt-3">
                                        <span className="font-semibold text-rose-700">Invalid values</span>
                                        <p className="mt-1 break-words font-mono">{activityCoverage.invalidFactKeys.join(', ')}</p>
                                    </div>
                                ) : null}
                            </div>
                        ) : null}
                    </section>
                </div>
            </details>
        </article>
    );
};

const TemplateCard: React.FC<{ template: TravelTemplateCatalogItem }> = ({ template }) => (
    <article
        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
        style={{ contentVisibility: 'auto', containIntrinsicSize: '360px' }}
    >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
                <span className="inline-flex rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700">
                    {humanizeToken(template.journeyType)}
                </span>
                <h3 className="mt-3 text-lg font-black tracking-tight text-slate-950">{template.copy.title}</h3>
                <p className="mt-1 break-all font-mono text-xs text-slate-500">{template.templateKey} · v{template.version}</p>
            </div>
            <span className="rounded-xl bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700">
                {template.minDays}–{template.maxDays} days
            </span>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-slate-600">{template.copy.summary}</p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
            {template.stops.map((stop, index) => (
                <React.Fragment key={`${stop.entityId}:${stop.sequence}`}>
                    {index > 0 ? <span className="text-slate-300">→</span> : null}
                    <span className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700">
                        <MapPin size={13} /> {stop.entityName} · {stop.minNights}–{stop.maxNights} nights
                    </span>
                </React.Fragment>
            ))}
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <span className="inline-flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
                <Path size={15} /> {template.legs.length} sourced route legs
            </span>
            <span className="inline-flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
                <Tag size={15} /> {template.tags.map((tag) => humanizeToken(tag.tagKey)).join(', ') || 'No tags'}
            </span>
        </div>
    </article>
);

export const TravelKnowledgeCatalog: React.FC<TravelKnowledgeCatalogProps> = ({
    pack,
    source,
    searchValue,
    isLoading,
}) => {
    const [mode, setMode] = useState<CatalogMode>('entities');
    const [entityType, setEntityType] = useState<EntityTypeFilter>('all');
    const [activityCoverageFilter, setActivityCoverageFilter] = useState<ActivityCoverageFilter>('all');
    const [catalogSort, setCatalogSort] = useState<CatalogSort>('catalog');
    const normalizedSearch = searchValue.trim().toLowerCase();
    const entityById = useMemo(() => new Map(
        (pack?.entities ?? []).map((entity) => [entity.entityId, entity]),
    ), [pack]);
    const typeCounts = useMemo(() => {
        const counts = new Map<TravelEntityType, number>();
        for (const entity of pack?.entities ?? []) {
            counts.set(entity.entityType, (counts.get(entity.entityType) ?? 0) + 1);
        }
        return counts;
    }, [pack]);
    const filteredEntities = useMemo(() => (
        (pack?.entities ?? [])
            .filter((entity) => entityType === 'all' || entity.entityType === entityType)
            .filter((entity) => {
                if (activityCoverageFilter === 'all') return true;
                const coverage = getTravelActivityKnowledgeCoverage(entity);
                if (activityCoverageFilter === 'needs_work') {
                    return coverage?.status === 'starter' || coverage?.status === 'usable';
                }
                return coverage?.status === activityCoverageFilter;
            })
            .filter((entity) => !normalizedSearch || entitySearchText(entity).includes(normalizedSearch))
            .toSorted((left, right) => {
                if (catalogSort === 'popularity') {
                    return right.popularityScore - left.popularityScore || left.name.localeCompare(right.name);
                }
                if (catalogSort === 'coverage_priority') {
                    const leftCoverage = getTravelActivityKnowledgeCoverage(left);
                    const rightCoverage = getTravelActivityKnowledgeCoverage(right);
                    return activityCoverageSortRank(leftCoverage) - activityCoverageSortRank(rightCoverage)
                        || (leftCoverage?.score ?? 101) - (rightCoverage?.score ?? 101)
                        || right.popularityScore - left.popularityScore
                        || left.name.localeCompare(right.name);
                }
                return left.entityType.localeCompare(right.entityType)
                    || right.popularityScore - left.popularityScore
                    || left.name.localeCompare(right.name);
            })
    ), [activityCoverageFilter, catalogSort, entityType, normalizedSearch, pack]);
    const filteredTemplates = useMemo(() => (
        (pack?.templates ?? [])
            .filter((template) => !normalizedSearch || templateSearchText(template).includes(normalizedSearch))
            .toSorted((left, right) => left.copy.title.localeCompare(right.copy.title))
    ), [normalizedSearch, pack]);
    const activityCoverageSummary = useMemo(() => {
        const coverage = (pack?.entities ?? [])
            .map((entity) => ({ entity, coverage: getTravelActivityKnowledgeCoverage(entity) }))
            .filter((item): item is { entity: TravelEntityCatalogItem; coverage: NonNullable<typeof item.coverage> } => Boolean(item.coverage));
        const counts: Record<TravelActivityCoverageStatus, number> = { starter: 0, usable: 0, rich: 0 };
        const missingCounts = new Map<string, number>();
        coverage.forEach(({ coverage: itemCoverage }) => {
            counts[itemCoverage.status] += 1;
            [...itemCoverage.missingRequiredFactKeys, ...itemCoverage.missingRecommendedFactKeys]
                .forEach((factKey) => missingCounts.set(factKey, (missingCounts.get(factKey) ?? 0) + 1));
        });
        return {
            total: coverage.length,
            counts,
            needsWorkCount: counts.starter + counts.usable,
            averageScore: coverage.length > 0
                ? Math.round(coverage.reduce((sum, item) => sum + item.coverage.score, 0) / coverage.length)
                : 0,
            commonGaps: Array.from(missingCounts.entries())
                .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
                .slice(0, 4),
        };
    }, [pack]);

    if (isLoading && !pack) {
        return <AdminSurfaceCard className="py-14 text-center text-sm text-slate-500">Loading the published catalogue…</AdminSurfaceCard>;
    }
    if (!pack) {
        return <AdminSurfaceCard className="py-14 text-center text-sm text-slate-500">The published catalogue is unavailable.</AdminSurfaceCard>;
    }

    return (
        <div className="space-y-4">
            <AdminSurfaceCard className="space-y-4">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div>
                        <div className="flex items-center gap-2">
                            <Buildings size={20} weight="duotone" className="text-accent-700" />
                            <h2 className="text-base font-black tracking-tight text-slate-950">Published catalogue</h2>
                        </div>
                        <p className="mt-1 text-sm text-slate-500">
                            Dataset {pack.dataset?.version ?? 'local'} · {source ?? 'unknown source'} · generated {formatTimestamp(pack.dataset?.generatedAt)}
                        </p>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                        <Select value={mode} onValueChange={(value) => {
                            setMode(value as CatalogMode);
                            trackEvent('admin__travel_knowledge_catalog_mode--change', { mode: value });
                        }}>
                            <SelectTrigger className="min-w-44" aria-label="Catalogue content">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="entities">Entities</SelectItem>
                                <SelectItem value="templates">Route templates</SelectItem>
                            </SelectContent>
                        </Select>
                        {mode === 'entities' ? (
                            <Select value={entityType} onValueChange={(value) => {
                                setEntityType(value as EntityTypeFilter);
                                if (value !== 'all' && value !== 'poi') setActivityCoverageFilter('all');
                            }}>
                                <SelectTrigger className="min-w-44" aria-label="Entity type">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All entity types</SelectItem>
                                    {TRAVEL_ENTITY_TYPE_VALUES.map((type) => (
                                        <SelectItem key={type} value={type}>{humanizeToken(type)} ({typeCounts.get(type) ?? 0})</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        ) : null}
                        {mode === 'entities' ? (
                            <Select value={catalogSort} onValueChange={(value) => {
                                setCatalogSort(value as CatalogSort);
                                trackEvent('admin__travel_knowledge_catalog_sort--change', { sort: value });
                            }}>
                                <SelectTrigger
                                    className="min-w-44"
                                    aria-label="Catalogue sort"
                                    {...getAnalyticsDebugAttributes('admin__travel_knowledge_catalog_sort--change')}
                                >
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="catalog">Catalogue order</SelectItem>
                                    <SelectItem value="coverage_priority">Coverage priority</SelectItem>
                                    <SelectItem value="popularity">Popularity</SelectItem>
                                </SelectContent>
                            </Select>
                        ) : null}
                        {mode === 'entities' && (entityType === 'all' || entityType === 'poi') ? (
                            <Select value={activityCoverageFilter} onValueChange={(value) => {
                                setActivityCoverageFilter(value as ActivityCoverageFilter);
                                trackEvent('admin__travel_knowledge_coverage--filter', { coverage: value });
                            }}>
                                <SelectTrigger className="min-w-44" aria-label="Activity coverage">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All coverage levels</SelectItem>
                                    <SelectItem value="needs_work">Needs work ({activityCoverageSummary.needsWorkCount})</SelectItem>
                                    <SelectItem value="rich">Rich ({activityCoverageSummary.counts.rich})</SelectItem>
                                    <SelectItem value="usable">Usable ({activityCoverageSummary.counts.usable})</SelectItem>
                                    <SelectItem value="starter">Starter ({activityCoverageSummary.counts.starter})</SelectItem>
                                </SelectContent>
                            </Select>
                        ) : null}
                    </div>
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-slate-600">
                    {TRAVEL_ENTITY_TYPE_VALUES.filter((type) => (typeCounts.get(type) ?? 0) > 0).map((type) => (
                        <span key={type} className="rounded-full bg-slate-100 px-2.5 py-1">
                            {humanizeToken(type)} {typeCounts.get(type)}
                        </span>
                    ))}
                </div>
                <div className="grid gap-2 border-t border-slate-100 pt-4 sm:grid-cols-4">
                    <div className="rounded-xl bg-slate-50 p-3">
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Activity POIs</div>
                        <div className="mt-1 text-xl font-black text-slate-900">{activityCoverageSummary.total}</div>
                    </div>
                    <div className="rounded-xl bg-emerald-50 p-3">
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">Rich</div>
                        <div className="mt-1 text-xl font-black text-emerald-900">{activityCoverageSummary.counts.rich}</div>
                    </div>
                    <div className="rounded-xl bg-amber-50 p-3">
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-amber-700">Needs work</div>
                        <div className="mt-1 text-xl font-black text-amber-900">{activityCoverageSummary.needsWorkCount}</div>
                        <div className="mt-1 text-[11px] text-amber-800">
                            {activityCoverageSummary.counts.usable} usable · {activityCoverageSummary.counts.starter} starter
                        </div>
                    </div>
                    <div className="rounded-xl bg-violet-50 p-3">
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-violet-700">Average coverage</div>
                        <div className="mt-1 text-xl font-black text-violet-900">{activityCoverageSummary.averageScore}%</div>
                    </div>
                </div>
                {activityCoverageSummary.commonGaps.length > 0 ? (
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-xs text-slate-500">
                            Most common gaps: {activityCoverageSummary.commonGaps.map(([factKey, count]) => `${humanizeToken(factKey)} (${count})`).join(' · ')}
                        </p>
                        <button
                            type="button"
                            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900 transition-colors hover:bg-amber-100"
                            onClick={() => {
                                setMode('entities');
                                setEntityType('poi');
                                setActivityCoverageFilter('needs_work');
                                setCatalogSort('coverage_priority');
                                trackEvent('admin__travel_knowledge_enrichment_queue--open', {
                                    entity_count: activityCoverageSummary.needsWorkCount,
                                });
                            }}
                            {...getAnalyticsDebugAttributes('admin__travel_knowledge_enrichment_queue--open')}
                        >
                            <GitDiff size={15} /> Open enrichment queue ({activityCoverageSummary.needsWorkCount})
                        </button>
                    </div>
                ) : null}
            </AdminSurfaceCard>

            <p className="text-sm text-slate-500">
                Showing {mode === 'entities' ? filteredEntities.length : filteredTemplates.length} {mode}. Search covers names, aliases, facts, tags, source keys, and route stops.
            </p>

            <div className="space-y-4">
                {mode === 'entities' ? filteredEntities.map((entity) => (
                    <EntityCard
                        key={entity.entityId}
                        entity={entity}
                        parentName={entity.parentId ? entityById.get(entity.parentId)?.name : undefined}
                    />
                )) : filteredTemplates.map((template) => (
                    <TemplateCard key={template.id} template={template} />
                ))}
            </div>

            {(mode === 'entities' ? filteredEntities.length : filteredTemplates.length) === 0 ? (
                <AdminSurfaceCard className="py-12 text-center">
                    <h2 className="text-base font-black text-slate-900">No catalogue entries match</h2>
                    <p className="mt-1 text-sm text-slate-500">Change the search or entity-type filter.</p>
                </AdminSurfaceCard>
            ) : null}
        </div>
    );
};
