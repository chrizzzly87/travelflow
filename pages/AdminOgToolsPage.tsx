import { TripOgPreviewPanel } from '../components/admin/TripOgPreviewPanel';
import { isTripVideoId } from '../shared/tripOgVideo';
import React, { useMemo, useRef, useState } from 'react';
import {
    ClipboardText,
    LinkSimpleHorizontal,
    MagnifyingGlass,
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

const fieldLabelClassName = 'text-xs font-medium text-muted-foreground';

const CommandBlock: React.FC<{
    label: string;
    command: string;
    isCopied: boolean;
    onCopy: () => void;
}> = ({ label, command, isCopied, onCopy }) => (
    <div className="overflow-hidden rounded-md border border-border bg-muted/40">
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-1.5">
            <span className="text-xs font-medium text-muted-foreground">{label}</span>
            <Button type="button" variant="ghost" size="xs" onClick={onCopy} aria-label={`Copy ${label.toLowerCase()}`}>
                <ClipboardText aria-hidden="true" />
                <span aria-live="polite">{isCopied ? 'Copied' : 'Copy'}</span>
            </Button>
        </div>
        <code className="block overflow-x-auto whitespace-pre px-3 py-2 font-mono text-xs text-foreground">{command}</code>
    </div>
);

const formatModeLabel = (value: OgInspectionResult['mode']): string => {
    if (value === 'static') return 'Static (pre-generated image)';
    if (value === 'dynamic') return 'Dynamic (edge-generated image)';
    return 'Unknown';
};

const formatKindLabel = (value: OgInspectionResult['imageKind']): string => {
    if (value === 'static-generated') return 'Static generated image';
    if (value === 'dynamic-site') return 'Dynamic /api/og/site image';
    if (value === 'dynamic-trip') return 'Dynamic /api/og/trip image';
    if (value === 'missing') return 'Missing image';
    return 'Unknown image source';
};

export const AdminOgToolsPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'analyzer' | 'playground' | 'video'>(() => new URLSearchParams(window.location.search).has('trip') ? 'video' : 'analyzer');
    const [videoTripInput, setVideoTripInput] = useState(() => new URLSearchParams(window.location.search).get('trip') || '4fee56dd-a79a-4130-bef0-cc7ffb552ea5');
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

    const copyText = async (key: string, value: string): Promise<void> => {
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

    const runInspect = async (rawValue: string): Promise<void> => {
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

    const validatePlaygroundEmbed = (): void => {
        const frame = playgroundFrameRef.current;
        if (!frame) return;

        try {
            const doc = frame.contentDocument;
            if (!doc) {
                setPlaygroundLoadIssue('Could not access embedded OG playground document. Use "Open standalone" as fallback.');
                return;
            }

            const title = doc.title.trim();
            if (title === OG_PLAYGROUND_TITLE) {
                setPlaygroundLoadIssue(null);
                return;
            }

            const loadedSpaShell = Boolean(doc.querySelector('#root'));
            if (loadedSpaShell) {
                setPlaygroundLoadIssue('Embedded view loaded the app shell instead of /api/og/playground. Use "Open standalone" and verify Netlify edge routing.');
                return;
            }

            setPlaygroundLoadIssue(`Embedded view returned unexpected content (${title || 'untitled document'}). Open standalone for the full legacy controls.`);
        } catch {
            setPlaygroundLoadIssue('Could not inspect embedded OG playground content. Use "Open standalone" as fallback.');
        }
    };

    const metadataRows: Array<{ label: string; value: string; breakAll?: boolean; hint?: string }> = inspectResult ? [
        { label: 'Requested URL', value: inspectResult.requestUrl, breakAll: true },
        { label: 'Final URL', value: inspectResult.finalUrl, breakAll: true },
        { label: 'Canonical', value: inspectResult.metadata.canonical || 'missing', breakAll: true },
        { label: 'OG title', value: inspectResult.metadata.ogTitle || 'missing' },
        { label: 'OG description', value: inspectResult.metadata.ogDescription || 'missing' },
        { label: 'OG image', value: inspectResult.metadata.ogImage || 'missing', breakAll: true, hint: formatKindLabel(inspectResult.imageKind) },
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
            description="Inspect live Open Graph output, build static image commands and preview trip sharing media."
            showGlobalSearch={false}
            showDateRange={false}
        >
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'analyzer' | 'playground' | 'video')} className="gap-4">
                <TabsList className="max-w-full overflow-x-auto">
                    <TabsTrigger value="analyzer">URL analyzer</TabsTrigger>
                    <TabsTrigger value="playground">OG playground</TabsTrigger>
                    <TabsTrigger value="video">Trip video</TabsTrigger>
                </TabsList>

                <TabsContent value="analyzer" className="flex flex-col gap-6">
                    <AdminSurfaceCard className="flex flex-col gap-4">
                        <AdminSectionHeader
                            title="URL inspector"
                            description={<>Reads the real rendered page metadata and previews the exact <code className="font-mono text-xs">og:image</code> output.</>}
                            actions={inspectResult?.mode === 'static' ? (
                                <AdminStatusBadge tone="success">Static mode</AdminStatusBadge>
                            ) : inspectResult?.mode === 'dynamic' ? (
                                <AdminStatusBadge tone="warning">Dynamic mode</AdminStatusBadge>
                            ) : null}
                        />

                        <form
                            className="grid gap-2 sm:grid-cols-[1fr_auto]"
                            onSubmit={(event) => {
                                event.preventDefault();
                                void runInspect(urlInput);
                            }}
                        >
                            <Input
                                value={urlInput}
                                onChange={(event) => setUrlInput(event.target.value)}
                                placeholder="/blog or https://travelflowapp.netlify.app/blog"
                                className="h-9"
                                aria-label="Route URL or path"
                            />
                            <Button type="submit" disabled={isInspecting}>
                                <MagnifyingGlass aria-hidden="true" />
                                {isInspecting ? 'Inspecting…' : 'Inspect'}
                            </Button>
                        </form>

                        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Preset paths">
                            {PRESET_PATHS.map((preset) => (
                                <Button
                                    key={preset}
                                    type="button"
                                    variant="outline"
                                    size="xs"
                                    className="font-mono"
                                    onClick={() => {
                                        setUrlInput(preset);
                                        void runInspect(preset);
                                    }}
                                >
                                    {preset}
                                </Button>
                            ))}
                        </div>

                        {inspectError && <AdminErrorAlert message={inspectError} />}

                        {inspectResult && (
                            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
                                <div className="flex min-w-0 flex-col gap-3">
                                    <div className="grid gap-3 md:grid-cols-3">
                                        <div className="rounded-md border border-border bg-muted/40 px-3 py-2">
                                            <div className={fieldLabelClassName}>HTTP status</div>
                                            <div className="mt-1 flex items-center gap-2 text-sm font-medium text-foreground tabular-nums">
                                                {inspectResult.status}
                                                <AdminStatusBadge tone={inspectResult.ok ? 'success' : 'danger'}>{inspectResult.ok ? 'OK' : 'Error'}</AdminStatusBadge>
                                            </div>
                                        </div>
                                        <div className="min-w-0 rounded-md border border-border bg-muted/40 px-3 py-2">
                                            <div className={fieldLabelClassName}>OG source</div>
                                            <div className="mt-1 break-all text-sm font-medium text-foreground">{inspectResult.sourceHeader || 'header not set'}</div>
                                        </div>
                                        <div className="rounded-md border border-border bg-muted/40 px-3 py-2">
                                            <div className={fieldLabelClassName}>Image mode</div>
                                            <div className="mt-1 text-sm font-medium text-foreground">{formatModeLabel(inspectResult.mode)}</div>
                                        </div>
                                    </div>

                                    <dl className="divide-y divide-border rounded-md border border-border text-sm">
                                        {metadataRows.map((row) => (
                                            <div key={row.label} className="grid gap-1 px-3 py-2 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-3">
                                                <dt className={fieldLabelClassName}>{row.label}</dt>
                                                <dd className={row.breakAll ? 'break-all text-foreground' : 'text-foreground'}>
                                                    {row.value}
                                                    {row.hint && <div className="mt-0.5 text-xs text-muted-foreground">{row.hint}</div>}
                                                </dd>
                                            </div>
                                        ))}
                                    </dl>
                                </div>

                                <aside className="flex min-w-0 flex-col gap-2 rounded-md border border-border bg-muted/40 p-3">
                                    <div className="flex items-center justify-between gap-2">
                                        <h3 className="text-sm font-semibold text-foreground">Rendered OG image</h3>
                                        {inspectResult.resolvedOgImageUrl && (
                                            <Button asChild variant="link" size="xs" className="h-auto px-0">
                                                <a href={inspectResult.resolvedOgImageUrl} target="_blank" rel="noreferrer">
                                                    Open image
                                                </a>
                                            </Button>
                                        )}
                                    </div>
                                    {inspectResult.resolvedOgImageUrl ? (
                                        <img
                                            src={inspectResult.resolvedOgImageUrl}
                                            alt="Rendered open graph preview"
                                            className="h-auto w-full rounded-md border border-border bg-card"
                                            loading="lazy"
                                        />
                                    ) : (
                                        <AdminEmptyState
                                            className="bg-card py-6"
                                            title="No image to render"
                                            description="This page has no renderable og:image URL."
                                        />
                                    )}
                                    {inspectResult.metadata.ogVideo && (
                                        <div className="mt-2 flex flex-col gap-2">
                                            <h3 className="text-sm font-semibold text-foreground">Attached OG video</h3>
                                            <video src={inspectResult.metadata.ogVideo} controls muted playsInline preload="none" className="w-full rounded-md" aria-label="Attached Open Graph video" />
                                            <p className="break-all text-xs text-muted-foreground">{inspectResult.metadata.ogVideo}</p>
                                        </div>
                                    )}
                                </aside>
                            </div>
                        )}
                    </AdminSurfaceCard>

                    <AdminSurfaceCard className="flex flex-col gap-4">
                        <AdminSectionHeader
                            title="Static OG build commands"
                            description="Build command-line filters for static OG generation. Leave the inputs empty for the default priority scope."
                        />
                        <p className="text-xs text-muted-foreground">
                            RTL locales (<code className="font-mono">fa</code>, <code className="font-mono">ur</code>) render through the dynamic <code className="font-mono">/api/og/site</code> image for font shaping and layout fidelity, so RTL-only filtered builds do nothing by design.
                        </p>

                        <Alert>
                            <AlertDescription>
                                Default static scope pre-generates only the localized home, blog overview, inspirations overview and <code className="font-mono">/example/*</code> template cards.
                                Example routes still resolve dynamic trip OG output at runtime for card-layout parity, and every other route stays dynamic with edge caching unless you run the full-scope command below.
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
                                label="Build command"
                                command={commands.buildCommand}
                                isCopied={copiedKey === 'build'}
                                onCopy={() => void copyText('build', commands.buildCommand)}
                            />
                            <CommandBlock
                                label="Validation command"
                                command={commands.validateCommand}
                                isCopied={copiedKey === 'validate'}
                                onCopy={() => void copyText('validate', commands.validateCommand)}
                            />

                            <div className="rounded-md border border-border px-3 py-2 text-sm text-foreground">
                                <div className="mb-1 flex items-center gap-1.5 font-medium text-foreground">
                                    <LinkSimpleHorizontal size={14} aria-hidden="true" /> Release-safe default run
                                </div>
                                <code className="block overflow-x-auto whitespace-pre font-mono text-xs text-foreground">{commands.releaseSafeCommand}</code>
                                {commands.hasFilters && (
                                    <p className="mt-2 text-xs text-muted-foreground">
                                        Filtered builds only regenerate the selected route keys. Run the default release-safe command before final deploy checks.
                                    </p>
                                )}
                            </div>

                            <CommandBlock
                                label="Full-scope override command"
                                command={commands.fullScopeCommand}
                                isCopied={copiedKey === 'fullscope'}
                                onCopy={() => void copyText('fullscope', commands.fullScopeCommand)}
                            />
                        </div>
                    </AdminSurfaceCard>
                </TabsContent>

                <TabsContent value="video" className="flex flex-col gap-4">
                    <form className="flex flex-col gap-2 sm:flex-row" onSubmit={event => { event.preventDefault(); if (isTripVideoId(videoTripInput)) setVideoTripId(videoTripInput); }}>
                        <Input aria-label="Trip ID for video preview" value={videoTripInput} onChange={event => setVideoTripInput(event.target.value.trim())} className="h-9 font-mono text-xs sm:max-w-md" placeholder="Trip UUID" />
                        <Button type="submit" disabled={!isTripVideoId(videoTripInput)}>Load trip previews</Button>
                    </form>
                    {isTripVideoId(videoTripId) && <TripOgPreviewPanel key={videoTripId} tripId={videoTripId} />}
                </TabsContent>
                <TabsContent value="playground">
                    <AdminSurfaceCard className="flex flex-col gap-4">
                        <AdminSectionHeader
                            title="OG playground"
                            description={<>The full legacy playground for <code className="font-mono text-xs">/api/og/site</code> and <code className="font-mono text-xs">/api/og/trip</code> with all original query controls.</>}
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
                                            Trip mode
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
                                            Site mode
                                        </Button>
                                    </div>
                                    <Button asChild variant="outline" size="sm">
                                        <a href={playgroundSrc} target="_blank" rel="noreferrer">
                                            Open standalone
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
            </Tabs>
        </AdminShell>
    );
};
