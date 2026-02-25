import React, { useMemo, useState } from 'react';
import { CheckCircle, ClipboardText, LinkSimpleHorizontal, MagnifyingGlass, WarningCircle } from '@phosphor-icons/react';
import { AdminShell } from '../components/admin/AdminShell';
import {
    buildSiteOgBuildCommands,
    inspectOgUrl,
    parseCsvListInput,
    type OgInspectionResult,
} from '../services/adminOgToolsService';

const PRESET_PATHS = [
    '/',
    '/blog',
    '/de/features',
    '/example/thailand-islands',
    '/inspirations/country/Japan',
];

const fieldClassName = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-accent-400 focus:ring-2 focus:ring-accent-100';

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
            setInspectError(error instanceof Error ? error.message : 'Could not inspect URL.');
            setInspectResult(null);
        } finally {
            setIsInspecting(false);
        }
    };

    return (
        <AdminShell
            title="Open Graph Tools"
            description="Inspect route metadata behavior and build filtered static OG generation commands."
            showGlobalSearch={false}
            showDateRange={false}
        >
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <header className="mb-4 flex items-start justify-between gap-3">
                    <div>
                        <h2 className="text-base font-semibold text-slate-900">URL Inspector</h2>
                        <p className="mt-1 text-sm text-slate-600">
                            Check same-origin routes and verify OG metadata plus static/dynamic image source behavior.
                        </p>
                    </div>
                    {inspectResult?.mode === 'static' ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                            <CheckCircle size={14} /> Static mode
                        </span>
                    ) : inspectResult?.mode === 'dynamic' ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                            <WarningCircle size={14} /> Dynamic mode
                        </span>
                    ) : null}
                </header>

                <form
                    className="grid gap-3 md:grid-cols-[1fr_auto]"
                    onSubmit={(event) => {
                        event.preventDefault();
                        void runInspect(urlInput);
                    }}
                >
                    <input
                        value={urlInput}
                        onChange={(event) => setUrlInput(event.target.value)}
                        placeholder="/blog or https://travelflowapp.netlify.app/blog"
                        className={fieldClassName}
                        aria-label="Route URL or path"
                    />
                    <button
                        type="submit"
                        disabled={isInspecting}
                        className="inline-flex items-center justify-center gap-1 rounded-xl border border-accent-600 bg-accent-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        <MagnifyingGlass size={16} />
                        {isInspecting ? 'Inspecting…' : 'Inspect'}
                    </button>
                </form>

                <div className="mt-3 flex flex-wrap gap-2">
                    {PRESET_PATHS.map((preset) => (
                        <button
                            key={preset}
                            type="button"
                            onClick={() => {
                                setUrlInput(preset);
                                void runInspect(preset);
                            }}
                            className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-100"
                        >
                            {preset}
                        </button>
                    ))}
                </div>

                {inspectError && (
                    <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
                        {inspectError}
                    </p>
                )}

                {inspectResult && (
                    <div className="mt-5 space-y-3">
                        <div className="grid gap-3 md:grid-cols-3">
                            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">HTTP status</div>
                                <div className="mt-1 text-sm font-semibold text-slate-900">{inspectResult.status} ({inspectResult.ok ? 'OK' : 'Error'})</div>
                            </div>
                            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">OG source</div>
                                <div className="mt-1 text-sm font-semibold text-slate-900">{inspectResult.sourceHeader || 'header not set'}</div>
                            </div>
                            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Image mode</div>
                                <div className="mt-1 text-sm font-semibold text-slate-900">{formatModeLabel(inspectResult.mode)}</div>
                            </div>
                        </div>

                        <dl className="grid gap-2 text-sm">
                            <div className="rounded-xl border border-slate-200 px-3 py-2">
                                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Requested URL</dt>
                                <dd className="mt-1 break-all text-slate-800">{inspectResult.requestUrl}</dd>
                            </div>
                            <div className="rounded-xl border border-slate-200 px-3 py-2">
                                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Final URL</dt>
                                <dd className="mt-1 break-all text-slate-800">{inspectResult.finalUrl}</dd>
                            </div>
                            <div className="rounded-xl border border-slate-200 px-3 py-2">
                                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Canonical</dt>
                                <dd className="mt-1 break-all text-slate-800">{inspectResult.metadata.canonical || 'missing'}</dd>
                            </div>
                            <div className="rounded-xl border border-slate-200 px-3 py-2">
                                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">OG title</dt>
                                <dd className="mt-1 text-slate-800">{inspectResult.metadata.ogTitle || 'missing'}</dd>
                            </div>
                            <div className="rounded-xl border border-slate-200 px-3 py-2">
                                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">OG description</dt>
                                <dd className="mt-1 text-slate-800">{inspectResult.metadata.ogDescription || 'missing'}</dd>
                            </div>
                            <div className="rounded-xl border border-slate-200 px-3 py-2">
                                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">OG image</dt>
                                <dd className="mt-1 break-all text-slate-800">{inspectResult.metadata.ogImage || 'missing'}</dd>
                                <div className="mt-1 text-xs text-slate-500">{formatKindLabel(inspectResult.imageKind)}</div>
                            </div>
                        </dl>
                    </div>
                )}
            </section>

            <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <header className="mb-4">
                    <h2 className="text-base font-semibold text-slate-900">Static OG Build Command Builder</h2>
                    <p className="mt-1 text-sm text-slate-600">
                        Build command-line filters for static OG generation. Leave inputs empty for a full build.
                    </p>
                </header>

                <div className="grid gap-3 md:grid-cols-2">
                    <label className="space-y-1">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Locales (CSV)</span>
                        <input
                            value={localesInput}
                            onChange={(event) => setLocalesInput(event.target.value)}
                            placeholder="en,de,fr"
                            className={fieldClassName}
                        />
                    </label>
                    <label className="space-y-1">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Include paths (CSV)</span>
                        <input
                            value={includePathsInput}
                            onChange={(event) => setIncludePathsInput(event.target.value)}
                            placeholder="/,/blog,/de/blog"
                            className={fieldClassName}
                        />
                    </label>
                    <label className="space-y-1">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Include prefixes (CSV)</span>
                        <input
                            value={includePrefixesInput}
                            onChange={(event) => setIncludePrefixesInput(event.target.value)}
                            placeholder="/blog,/inspirations,/de/blog"
                            className={fieldClassName}
                        />
                    </label>
                    <label className="space-y-1">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Exclude paths (CSV)</span>
                        <input
                            value={excludePathsInput}
                            onChange={(event) => setExcludePathsInput(event.target.value)}
                            placeholder="/blog/draft-slug"
                            className={fieldClassName}
                        />
                    </label>
                    <label className="space-y-1 md:col-span-2">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Exclude prefixes (CSV)</span>
                        <input
                            value={excludePrefixesInput}
                            onChange={(event) => setExcludePrefixesInput(event.target.value)}
                            placeholder="/example,/ko/blog"
                            className={fieldClassName}
                        />
                    </label>
                </div>

                <div className="mt-4 space-y-3">
                    <div className="rounded-xl border border-slate-200 bg-slate-900 p-3 text-slate-100">
                        <div className="mb-2 flex items-center justify-between gap-2">
                            <div className="text-xs font-semibold uppercase tracking-wide text-slate-300">Build command</div>
                            <button
                                type="button"
                                onClick={() => void copyText('build', commands.buildCommand)}
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-600 px-2 py-1 text-xs font-semibold text-slate-100 hover:bg-slate-800"
                            >
                                <ClipboardText size={14} />
                                {copiedKey === 'build' ? 'Copied' : 'Copy'}
                            </button>
                        </div>
                        <code className="block overflow-x-auto whitespace-pre text-xs">{commands.buildCommand}</code>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-900 p-3 text-slate-100">
                        <div className="mb-2 flex items-center justify-between gap-2">
                            <div className="text-xs font-semibold uppercase tracking-wide text-slate-300">Validation command</div>
                            <button
                                type="button"
                                onClick={() => void copyText('validate', commands.validateCommand)}
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-600 px-2 py-1 text-xs font-semibold text-slate-100 hover:bg-slate-800"
                            >
                                <ClipboardText size={14} />
                                {copiedKey === 'validate' ? 'Copied' : 'Copy'}
                            </button>
                        </div>
                        <code className="block overflow-x-auto whitespace-pre text-xs">{commands.validateCommand}</code>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                        <div className="mb-1 flex items-center gap-1 font-semibold text-slate-800">
                            <LinkSimpleHorizontal size={14} /> Release-safe full run
                        </div>
                        <code className="text-xs text-slate-700">{commands.releaseSafeCommand}</code>
                        {commands.hasFilters && (
                            <p className="mt-2 text-xs text-slate-600">
                                Filtered builds only regenerate selected route keys. Run the full release-safe command before final deploy checks.
                            </p>
                        )}
                    </div>
                </div>
            </section>
        </AdminShell>
    );
};
