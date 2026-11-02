import { TripOgPreviewPanel } from '../components/admin/TripOgPreviewPanel';
import { isTripVideoId } from '../shared/tripOgVideo';
import React, { useMemo, useRef, useState } from 'react';
import { useSearchParams } from '@/app/navigation';
import {
    ArrowSquareOut,
    ClipboardText,
    MagnifyingGlass,
    ShareNetwork,
    WarningCircle,
} from '@phosphor-icons/react';
import { AdminShell } from '../components/admin/AdminShell';
import { AdminSurfaceCard } from '../components/admin/AdminSurfaceCard';
import { AdminSectionHeader } from '../components/admin/AdminSectionHeader';
import { AdminStatusBadge } from '../components/admin/AdminStatusBadge';
import { AdminEmptyState } from '../components/admin/AdminEmptyState';
import { AdminErrorAlert } from '../components/admin/AdminErrorAlert';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { getAnalyticsDebugAttributes, trackEvent } from '../services/analyticsService';
import {
    buildSiteOgBuildCommands,
    inspectOgUrl,
    parseCsvListInput,
    type OgInspectionResult,
} from '../services/adminOgToolsService';

const PRESET_PATHS = [
    '/',
    '/fa',
    '/fa/features',
    '/blog',
    '/fa/blog',
    '/ur',
    '/de/features',
    '/example/thailand-islands',
    '/example/italy-classic',
    '/inspirations/country/Japan',
];

const OG_PLAYGROUND_PATH = '/api/og/playground';
const OG_PLAYGROUND_TITLE = 'TravelFlow OG Playground';
const SAMPLE_TRIP_ID = '4fee56dd-a79a-4130-bef0-cc7ffb552ea5';

export type OgToolsTab = 'inspect' | 'video' | 'playground' | 'commands';
const OG_TOOLS_TABS: OgToolsTab[] = ['inspect', 'video', 'playground', 'commands'];

/**
 * The tab a URL opens on. `?tab=` wins; a `?trip=` link (from the edge
 * playground or a trip) opens the trip video tab; the old `analyzer` id still
 * lands on the inspector.
 */
export const resolveOgToolsTab = (search: string): OgToolsTab => {
    const params = new URLSearchParams(search);
    const requested = params.get('tab');
    if (requested === 'analyzer') return 'inspect';
    if (requested && (OG_TOOLS_TABS as string[]).includes(requested)) return requested as OgToolsTab;
    return params.has('trip') ? 'video' : 'inspect';
};

const fieldLabelClassName = 'text-xs font-medium text-muted-foreground';

const CommandBlock: React.FC<{
    id: string;
    label: string;
    command: string;
    isCopied: boolean;
    onCopy: () => void;
    note?: React.ReactNode;
}> = ({ id, label, command, isCopied, onCopy, note }) => (
    <div className="overflow-hidden rounded-md border border-border bg-muted/40">
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-1.5">
            <span className="text-xs font-medium text-muted-foreground">{label}</span>
            <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={onCopy}
                aria-label={`Copy ${label.toLowerCase()}`}
                {...getAnalyticsDebugAttributes('admin__og_tools--copy_command', { command: id })}
            >
                <ClipboardText aria-hidden="true" />
                <span aria-live="polite">{isCopied ? 'Copied' : 'Copy'}</span>
            </Button>
        </div>
        <code className="block overflow-x-auto whitespace-pre px-3 py-2 font-mono text-xs text-foreground">{command}</code>
        {note && <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">{note}</p>}
    </div>
);

const formatModeLabel = (value: OgInspectionResult['mode']): string => {
    if (value === 'static') return 'Static image';
    if (value === 'dynamic') return 'Dynamic image';
    return 'Unknown mode';
};

const formatKindLabel = (value: OgInspectionResult['imageKind']): string => {
    if (value === 'static-generated') return 'Pre-generated at build time';
    if (value === 'dynamic-site') return 'Rendered by /api/og/site';
    if (value === 'dynamic-trip') return 'Rendered by /api/og/trip';
    if (value === 'missing') return 'No og:image tag';
    return 'Unknown image source';
};

/**
 * OG tools: answer "what does this link look like when it is shared?".
 * The inspector is the default job; trip video, the legacy edge playground and
 * the static-build command builder are separate, less frequent jobs on their
 * own tabs.
 */
export const AdminOgToolsPage: React.FC = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState<OgToolsTab>(() => resolveOgToolsTab(searchParams.toString()));
    const [videoTripInput, setVideoTripInput] = useState(() => searchParams.get('trip') || SAMPLE_TRIP_ID);
    // Keeps the address bar in step with the tab and trip so the view can be shared.
    const replaceSearchParams = (patch: Record<string, string | null>): void => {
        setSearchParams((previous) => {
            const next = new URLSearchParams(previous);
            Object.entries(patch).forEach(([key, value]) => {
                if (value === null) next.delete(key);
                else next.set(key, value);
            });
            return next;
        }, { replace: true });
    };
    const [videoTripId, setVideoTripId] = useState(videoTripInput);
    const [playgroundMode, setPlaygroundMode] = useState<'trip' | 'site'>('trip');
    const [playgroundLoadIssue, setPlaygroundLoadIssue] = useState<string | null>(null);
    const playgroundFrameRef = useRef<HTMLIFrameElement | null>(null);

    const [urlInput, setUrlInput] = useState('/');
    const [isInspecting, setIsInspecting] = useState(false);
    const [inspectError, setInspectError] = useState<string | null>(null);
    const [inspectResult, setInspectResult] = useState<OgInspectionResult | null>(null);
    const [copiedKey, setCopiedKey] = useState<string | null>(null);

    const [localesInput, setLocalesInput] = useState('');
    const [includePathsInput, setIncludePathsInput] = useState('');
    const [includePrefixesInput, setIncludePrefixesInput] = useState('');
    const [excludePathsInput, setExcludePathsInput] = useState('');
    const [excludePrefixesInput, setExcludePrefixesInput] = useState('');

    const commands = useMemo(() => buildSiteOgBuildCommands({
        locales: parseCsvListInput(localesInput),
        includePaths: parseCsvListInput(includePathsInput),
        includePrefixes: parseCsvListInput(includePrefixesInput),
        excludePaths: parseCsvListInput(excludePathsInput),
        excludePrefixes: parseCsvListInput(excludePrefixesInput),
    }), [excludePathsInput, excludePrefixesInput, includePathsInput, includePrefixesInput, localesInput]);
    const playgroundSrc = `${OG_PLAYGROUND_PATH}?mode=${playgroundMode}`;

    const changeTab = (value: string): void => {
        const next = value as OgToolsTab;
        setActiveTab(next);
        replaceSearchParams({ tab: next === 'inspect' ? null : next });
        trackEvent('admin__og_tools--tab', { tab: next });
    };

    const copyText = async (key: string, value: string): Promise<void> => {
        trackEvent('admin__og_tools--copy_command', { command: key });
        try {
            await navigator.clipboard.writeText(value);
            setCopiedKey(key);
            window.setTimeout(() => {
                setCopiedKey((current) => (current === key ? null : current));
            }, 1600);
        } catch {
            setCopiedKey(null);
        }
    };

    const runInspect = async (rawValue: string, source: 'form' | 'preset'): Promise<void> => {
        trackEvent('admin__og_tools--inspect', { source });
        setIsInspecting(true);
        setInspectError(null);
        try {
            const result = await inspectOgUrl(rawValue, { origin: window.location.origin });
            setInspectResult(result);
        } catch (error) {
            // The service throws authored validation sentences; anything else
            // (a network TypeError, a parser crash) gets a sentence of our own.
            setInspectError(
                error instanceof Error && error.constructor === Error
                    ? error.message
                    : 'Could not reach that page. Check the URL and try again.'
            );
            setInspectResult(null);
        } finally {
            setIsInspecting(false);
        }
    };

    const loadTripPreviews = (): void => {
        if (!isTripVideoId(videoTripInput)) return;
        trackEvent('admin__og_tools--load_trip');
        setVideoTripId(videoTripInput);
        replaceSearchParams({ trip: videoTripInput });
    };

    const validatePlaygroundEmbed = (): void => {
        const frame = playgroundFrameRef.current;
        if (!frame) return;

        try {
            const doc = frame.contentDocument;
            if (!doc) {
                setPlaygroundLoadIssue('The embedded playground could not be read. Open it in a new tab instead.');
                return;
            }

            const title = doc.title.trim();
            if (title === OG_PLAYGROUND_TITLE) {
                setPlaygroundLoadIssue(null);
                return;
            }

            const loadedSpaShell = Boolean(doc.querySelector('#root'));
            if (loadedSpaShell) {
                setPlaygroundLoadIssue('The embed loaded the app instead of the playground, so edge functions are not served here. Open it in a new tab, or check the deploy’s edge routing.');
                return;
            }

            setPlaygroundLoadIssue(`The embed returned something unexpected (${title || 'an untitled page'}). Open it in a new tab instead.`);
        } catch {
            setPlaygroundLoadIssue('The embedded playground could not be read. Open it in a new tab instead.');
        }
    };

    const metadataRows: Array<{ label: string; value: string; breakAll?: boolean; hint?: string; missing?: boolean }> = inspectResult ? [
        { label: 'OG title', value: inspectResult.metadata.ogTitle || 'Missing', missing: !inspectResult.metadata.ogTitle },
        { label: 'OG description', value: inspectResult.metadata.ogDescription || 'Missing', missing: !inspectResult.metadata.ogDescription },
        { label: 'OG image', value: inspectResult.metadata.ogImage || 'Missing', breakAll: true, hint: formatKindLabel(inspectResult.imageKind), missing: !inspectResult.metadata.ogImage },
        { label: 'Canonical', value: inspectResult.metadata.canonical || 'Missing', breakAll: true, missing: !inspectResult.metadata.canonical },
        { label: 'Requested URL', value: inspectResult.requestUrl, breakAll: true },
        { label: 'Final URL', value: inspectResult.finalUrl, breakAll: true },
        { label: 'OG source header', value: inspectResult.sourceHeader || 'Not set' },
    ] : [];

    const csvFields: Array<{ id: string; label: string; value: string; onChange: (value: string) => void; placeholder: string; wide?: boolean }> = [
        { id: 'og-locales-input', label: 'Locales (CSV)', value: localesInput, onChange: setLocalesInput, placeholder: 'en,de,fr,fa,ur' },
        { id: 'og-include-paths-input', label: 'Include paths (CSV)', value: includePathsInput, onChange: setIncludePathsInput, placeholder: '/,/blog,/de/blog' },
        { id: 'og-include-prefixes-input', label: 'Include prefixes (CSV)', value: includePrefixesInput, onChange: setIncludePrefixesInput, placeholder: '/blog,/inspirations,/de/blog' },
        { id: 'og-exclude-paths-input', label: 'Exclude paths (CSV)', value: excludePathsInput, onChange: setExcludePathsInput, placeholder: '/blog/draft-slug' },
        { id: 'og-exclude-prefixes-input', label: 'Exclude prefixes (CSV)', value: excludePrefixesInput, onChange: setExcludePrefixesInput, placeholder: '/example,/ko/blog', wide: true },
    ];

    return (
        <AdminShell
            title="OG tools"
            description="Check what a page looks like when it is shared, and manage trip sharing videos."
            showGlobalSearch={false}
            showDateRange={false}
        >
            <Tabs value={activeTab} onValueChange={changeTab} className="gap-4">
                <TabsList className="max-w-full overflow-x-auto">
                    <TabsTrigger value="inspect" {...getAnalyticsDebugAttributes('admin__og_tools--tab', { tab: 'inspect' })}>Inspect a URL</TabsTrigger>
                    <TabsTrigger value="video" {...getAnalyticsDebugAttributes('admin__og_tools--tab', { tab: 'video' })}>Trip video</TabsTrigger>
                    <TabsTrigger value="playground" {...getAnalyticsDebugAttributes('admin__og_tools--tab', { tab: 'playground' })}>Playground</TabsTrigger>
                    <TabsTrigger value="commands" {...getAnalyticsDebugAttributes('admin__og_tools--tab', { tab: 'commands' })}>Build commands</TabsTrigger>
                </TabsList>

                <TabsContent value="inspect" className="flex flex-col gap-4">
                    <AdminSurfaceCard className="flex flex-col gap-4">
                        <AdminSectionHeader
                            title="Inspect a URL"
                            description={<>Fetches the rendered page and shows the exact <code className="font-mono text-xs">og:image</code> and tags a share card is built from.</>}
                        />

                        <form
                            className="grid gap-2 sm:grid-cols-[1fr_auto]"
                            onSubmit={(event) => {
                                event.preventDefault();
                                void runInspect(urlInput, 'form');
                            }}
                        >
                            <Input
                                value={urlInput}
                                onChange={(event) => setUrlInput(event.target.value)}
                                placeholder="/blog or https://travelflowapp.netlify.app/blog"
                                className="h-9"
                                aria-label="Route URL or path"
                            />
                            <Button
                                type="submit"
                                disabled={isInspecting}
                                {...getAnalyticsDebugAttributes('admin__og_tools--inspect', { source: 'form' })}
                            >
                                <MagnifyingGlass aria-hidden="true" />
                                {isInspecting ? 'Inspecting…' : 'Inspect'}
                            </Button>
                        </form>

                        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Preset paths">
                            <span className="me-1 text-xs text-muted-foreground">Try</span>
                            {PRESET_PATHS.map((preset) => (
                                <Button
                                    key={preset}
                                    type="button"
                                    variant="outline"
                                    size="xs"
                                    className="font-mono"
                                    disabled={isInspecting}
                                    onClick={() => {
                                        setUrlInput(preset);
                                        void runInspect(preset, 'preset');
                                    }}
                                    {...getAnalyticsDebugAttributes('admin__og_tools--inspect', { source: 'preset' })}
                                >
                                    {preset}
                                </Button>
                            ))}
                        </div>
                    </AdminSurfaceCard>

                    {inspectError && <AdminErrorAlert message={inspectError} />}

                    {isInspecting && !inspectResult && (
                        <p className="text-sm text-muted-foreground" role="status">Fetching the page…</p>
                    )}

                    {!inspectResult && !isInspecting && !inspectError && (
                        <AdminEmptyState
                            icon={<ShareNetwork />}
                            title="Nothing inspected yet"
                            description="Enter a path or pick a preset to see the share card it produces."
                        />
                    )}

                    {inspectResult && (
                        <AdminSurfaceCard className="flex flex-col gap-4" aria-busy={isInspecting || undefined}>
                            <AdminSectionHeader
                                as="h3"
                                title={<span className="break-all font-mono text-sm">{inspectResult.finalUrl}</span>}
                                actions={(
                                    <>
                                        <AdminStatusBadge tone={inspectResult.ok ? 'success' : 'danger'}>
                                            <span className="tabular-nums">{inspectResult.status}</span> {inspectResult.ok ? 'OK' : 'Error'}
                                        </AdminStatusBadge>
                                        <AdminStatusBadge tone={inspectResult.mode === 'static' ? 'success' : inspectResult.mode === 'dynamic' ? 'warning' : 'neutral'}>
                                            {formatModeLabel(inspectResult.mode)}
                                        </AdminStatusBadge>
                                    </>
                                )}
                            />

                            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                                <figure className="flex min-w-0 flex-col gap-2">
                                    <figcaption className="flex items-center justify-between gap-2">
                                        <span className={fieldLabelClassName}>Share image</span>
                                        {inspectResult.resolvedOgImageUrl && (
                                            <Button asChild variant="link" size="xs" className="h-auto px-0">
                                                <a href={inspectResult.resolvedOgImageUrl} target="_blank" rel="noreferrer">
                                                    Open image
                                                    <ArrowSquareOut aria-hidden="true" />
                                                </a>
                                            </Button>
                                        )}
                                    </figcaption>
                                    {inspectResult.resolvedOgImageUrl ? (
                                        <img
                                            src={inspectResult.resolvedOgImageUrl}
                                            alt="Rendered open graph preview"
                                            className="h-auto w-full rounded-md border border-border bg-card"
                                            loading="lazy"
                                        />
                                    ) : (
                                        <AdminEmptyState
                                            className="py-6"
                                            title="No image to render"
                                            description="This page has no renderable og:image URL."
                                        />
                                    )}
                                    {inspectResult.metadata.ogVideo && (
                                        <div className="mt-2 flex flex-col gap-2">
                                            <span className={fieldLabelClassName}>Attached OG video</span>
                                            <video src={inspectResult.metadata.ogVideo} controls muted playsInline preload="none" className="w-full rounded-md" aria-label="Attached Open Graph video" />
                                            <p className="break-all text-xs text-muted-foreground">{inspectResult.metadata.ogVideo}</p>
                                        </div>
                                    )}
                                </figure>

                                <dl className="divide-y divide-border self-start rounded-md border border-border text-sm">
                                    {metadataRows.map((row) => (
                                        <div key={row.label} className="grid gap-1 px-3 py-2 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-3">
                                            <dt className={fieldLabelClassName}>{row.label}</dt>
                                            <dd className={`${row.breakAll ? 'break-all' : ''} ${row.missing ? 'text-amber-700 dark:text-amber-300' : 'text-foreground'}`}>
                                                {row.value}
                                                {row.hint && <div className="mt-0.5 text-xs text-muted-foreground">{row.hint}</div>}
                                            </dd>
                                        </div>
                                    ))}
                                </dl>
                            </div>
                        </AdminSurfaceCard>
                    )}
                </TabsContent>

                <TabsContent value="video" className="flex flex-col gap-4">
                    <AdminSurfaceCard className="flex flex-col gap-3">
                        <AdminSectionHeader
                            title="Trip video"
                            description="Load any trip, including private ones, to preview, render or replace its sharing video. The same panel is in each trip's details."
                        />
                        <form
                            className="flex flex-col gap-2 sm:flex-row"
                            onSubmit={(event) => {
                                event.preventDefault();
                                loadTripPreviews();
                            }}
                        >
                            <Input
                                aria-label="Trip ID for video preview"
                                value={videoTripInput}
                                onChange={(event) => setVideoTripInput(event.target.value.trim())}
                                className="h-9 font-mono text-xs sm:max-w-md"
                                placeholder="Trip UUID"
                            />
                            <Button
                                type="submit"
                                variant="outline"
                                disabled={!isTripVideoId(videoTripInput)}
                                {...getAnalyticsDebugAttributes('admin__og_tools--load_trip')}
                            >
                                Load trip previews
                            </Button>
                        </form>
                    </AdminSurfaceCard>
                    {isTripVideoId(videoTripId) && <TripOgPreviewPanel key={videoTripId} tripId={videoTripId} />}
                </TabsContent>

                <TabsContent value="playground">
                    <AdminSurfaceCard className="flex flex-col gap-4">
                        <AdminSectionHeader
                            title="Playground"
                            description={<>The edge playground for <code className="font-mono text-xs">/api/og/site</code> and <code className="font-mono text-xs">/api/og/trip</code>, with every query control.</>}
                            actions={(
                                <>
                                    <div className="inline-flex rounded-md border border-border p-0.5" role="group" aria-label="Playground mode">
                                        <Button
                                            type="button"
                                            variant="toggle"
                                            size="xs"
                                            aria-pressed={playgroundMode === 'trip'}
                                            onClick={() => {
                                                setPlaygroundMode('trip');
                                                setPlaygroundLoadIssue(null);
                                            }}
                                        >
                                            Trip
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="toggle"
                                            size="xs"
                                            aria-pressed={playgroundMode === 'site'}
                                            onClick={() => {
                                                setPlaygroundMode('site');
                                                setPlaygroundLoadIssue(null);
                                            }}
                                        >
                                            Site
                                        </Button>
                                    </div>
                                    <Button asChild variant="outline" size="sm">
                                        <a href={playgroundSrc} target="_blank" rel="noreferrer">
                                            Open in new tab
                                            <ArrowSquareOut aria-hidden="true" />
                                        </a>
                                    </Button>
                                </>
                            )}
                        />

                        {playgroundLoadIssue && (
                            <Alert variant="warning">
                                <WarningCircle weight="fill" />
                                <AlertDescription>{playgroundLoadIssue}</AlertDescription>
                            </Alert>
                        )}

                        <iframe
                            ref={playgroundFrameRef}
                            title="TravelFlow OG Playground"
                            src={playgroundSrc}
                            className="h-[980px] w-full rounded-md border border-border bg-card"
                            onLoad={validatePlaygroundEmbed}
                        />
                    </AdminSurfaceCard>
                </TabsContent>

                <TabsContent value="commands">
                    <AdminSurfaceCard className="flex flex-col gap-4">
                        <AdminSectionHeader
                            title="Static OG build commands"
                            description="Build the command line for pre-generating share images. Leave every filter empty for the default scope."
                        />

                        <Alert>
                            <AlertDescription>
                                The default scope pre-generates only the localized home, blog overview, inspirations overview and <code className="font-mono">/example/*</code> cards. Example routes still render trip images at runtime, and every other route stays dynamic with edge caching unless you run the full-scope command. RTL locales (<code className="font-mono">fa</code>, <code className="font-mono">ur</code>) always render dynamically for correct shaping, so an RTL-only filter builds nothing.
                            </AlertDescription>
                        </Alert>

                        <div className="grid gap-3 md:grid-cols-2">
                            {csvFields.map((field) => (
                                <label key={field.id} htmlFor={field.id} className={field.wide ? 'flex flex-col gap-1.5 md:col-span-2' : 'flex flex-col gap-1.5'}>
                                    <span className={fieldLabelClassName}>{field.label}</span>
                                    <Input
                                        id={field.id}
                                        aria-label={field.label}
                                        value={field.value}
                                        onChange={(event) => field.onChange(event.target.value)}
                                        placeholder={field.placeholder}
                                        className="h-9 font-mono text-xs"
                                    />
                                </label>
                            ))}
                        </div>

                        <div className="flex flex-col gap-3">
                            <CommandBlock
                                id="build"
                                label="Build command"
                                command={commands.buildCommand}
                                isCopied={copiedKey === 'build'}
                                onCopy={() => void copyText('build', commands.buildCommand)}
                            />
                            <CommandBlock
                                id="validate"
                                label="Validation command"
                                command={commands.validateCommand}
                                isCopied={copiedKey === 'validate'}
                                onCopy={() => void copyText('validate', commands.validateCommand)}
                            />
                            <CommandBlock
                                id="release"
                                label="Release-safe default run"
                                command={commands.releaseSafeCommand}
                                isCopied={copiedKey === 'release'}
                                onCopy={() => void copyText('release', commands.releaseSafeCommand)}
                                note={commands.hasFilters
                                    ? 'Filtered builds only regenerate the selected routes. Run this default command before the final deploy checks.'
                                    : undefined}
                            />
                            <CommandBlock
                                id="fullscope"
                                label="Full-scope override command"
                                command={commands.fullScopeCommand}
                                isCopied={copiedKey === 'fullscope'}
                                onCopy={() => void copyText('fullscope', commands.fullScopeCommand)}
                            />
                        </div>
                    </AdminSurfaceCard>
                </TabsContent>
            </Tabs>
        </AdminShell>
    );
};
