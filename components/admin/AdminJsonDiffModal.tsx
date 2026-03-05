import React, { useEffect, useMemo, useRef, useState } from 'react';
import { SpinnerGap } from '@phosphor-icons/react';
import Prism from 'prismjs';
import 'prismjs/components/prism-json';
import { AppModal } from '../ui/app-modal';
import { Checkbox } from '../ui/checkbox';
import {
    buildSideBySideJsonDiff,
    type JsonDiffLineType,
    type JsonDiffRow,
} from '../../services/jsonDiffService';

interface AdminJsonDiffModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    description?: string;
    beforeLabel?: string;
    afterLabel?: string;
    beforeValue: unknown;
    afterValue: unknown;
    isLoading?: boolean;
    errorMessage?: string | null;
}

const lineCellClassName = (type: JsonDiffLineType): string => {
    if (type === 'removed') return 'bg-rose-50 text-rose-900';
    if (type === 'added') return 'bg-emerald-50 text-emerald-900';
    if (type === 'empty') return 'bg-slate-50 text-slate-300';
    return 'bg-white text-slate-700';
};

const isChangedRow = (row: JsonDiffRow): boolean => (
    row.leftType !== 'context' || row.rightType !== 'context'
);

type FocusedRenderEntry =
    | { kind: 'row'; index: number; row: JsonDiffRow }
    | { kind: 'collapsed'; key: string; hiddenCount: number };

const buildFocusedRenderEntries = (
    rows: JsonDiffRow[],
    contextRadius = 2
): FocusedRenderEntry[] => {
    const changedIndices = rows
        .map((row, index) => ({ row, index }))
        .filter((entry) => isChangedRow(entry.row))
        .map((entry) => entry.index);

    if (changedIndices.length === 0) {
        return rows.map((row, index) => ({ kind: 'row', index, row }));
    }

    const focusedIndexSet = new Set<number>();
    changedIndices.forEach((index) => {
        for (let offset = -contextRadius; offset <= contextRadius; offset += 1) {
            const candidate = index + offset;
            if (candidate < 0 || candidate >= rows.length) continue;
            focusedIndexSet.add(candidate);
        }
    });

    const sortedIndices = Array.from(focusedIndexSet).sort((a, b) => a - b);
    const entries: FocusedRenderEntry[] = [];
    let previousIndex = -1;

    sortedIndices.forEach((index) => {
        if (previousIndex >= 0 && index - previousIndex > 1) {
            const hiddenCount = index - previousIndex - 1;
            entries.push({
                kind: 'collapsed',
                key: `collapsed-${previousIndex}-${index}`,
                hiddenCount,
            });
        }
        entries.push({ kind: 'row', index, row: rows[index] });
        previousIndex = index;
    });

    return entries;
};

const highlightJsonLine = (value: string | null): string => {
    if (value === null) return '';
    return Prism.highlight(value || ' ', Prism.languages.json, 'json');
};

const JSON_TOKEN_CLASSNAMES = [
    '[&_.token.property]:!text-sky-700',
    '[&_.token.string]:!text-emerald-700',
    '[&_.token.number]:!text-fuchsia-700',
    '[&_.token.boolean]:!text-amber-700',
    '[&_.token.null]:!text-slate-500',
    '[&_.token.punctuation]:!text-slate-500',
].join(' ');

export const AdminJsonDiffModal: React.FC<AdminJsonDiffModalProps> = ({
    isOpen,
    onClose,
    title,
    description,
    beforeLabel = 'Before snapshot',
    afterLabel = 'After snapshot',
    beforeValue,
    afterValue,
    isLoading = false,
    errorMessage = null,
}) => {
    const [focusedOnly, setFocusedOnly] = useState(true);
    const diffBeforePaneRef = useRef<HTMLDivElement | null>(null);
    const diffAfterPaneRef = useRef<HTMLDivElement | null>(null);
    const isDiffSyncingRef = useRef(false);

    const diff = useMemo(
        () => buildSideBySideJsonDiff(beforeValue, afterValue),
        [beforeValue, afterValue]
    );
    const focusedRenderEntries = useMemo(
        () => buildFocusedRenderEntries(diff.rows, 2),
        [diff.rows]
    );
    const renderEntries = focusedOnly
        ? focusedRenderEntries
        : diff.rows.map((row, index): FocusedRenderEntry => ({ kind: 'row', index, row }));

    const syncDiffVerticalScroll = (source: 'before' | 'after') => {
        if (isDiffSyncingRef.current) return;
        const sourceEl = source === 'before' ? diffBeforePaneRef.current : diffAfterPaneRef.current;
        const targetEl = source === 'before' ? diffAfterPaneRef.current : diffBeforePaneRef.current;
        if (!sourceEl || !targetEl) return;

        isDiffSyncingRef.current = true;
        targetEl.scrollTop = sourceEl.scrollTop;
        requestAnimationFrame(() => {
            isDiffSyncingRef.current = false;
        });
    };

    useEffect(() => {
        if (isOpen) return;
        setFocusedOnly(true);
    }, [isOpen]);

    return (
        <AppModal
            isOpen={isOpen}
            onClose={onClose}
            title={title}
            description={description}
            size="xl"
            mobileSheet={false}
            contentClassName="sm:w-[min(98vw,1320px)]"
            bodyClassName="space-y-3 overflow-y-auto p-4"
            closeLabel="Close diff modal"
        >
            {errorMessage && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    {errorMessage}
                </div>
            )}
            {isLoading ? (
                <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                    <SpinnerGap size={14} className="animate-spin" />
                    Loading snapshots...
                </div>
            ) : (
                <>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
                            <span className="inline-flex rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">
                                {diff.changedRowCount} changed line{diff.changedRowCount === 1 ? '' : 's'}
                            </span>
                            <span className="inline-flex rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">
                                {diff.rows.length} total line{diff.rows.length === 1 ? '' : 's'}
                            </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="inline-flex h-8 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700">
                                <Checkbox
                                    checked={!focusedOnly}
                                    onCheckedChange={(checked) => setFocusedOnly(!Boolean(checked))}
                                    aria-label="Show full diff"
                                />
                                Show full diff
                            </div>
                        </div>
                    </div>

                    {focusedOnly && (
                        <span className="inline-flex rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">
                            Showing focused context around changed lines
                        </span>
                    )}

                    <div className="grid grid-cols-1 gap-1 lg:grid-cols-2">
                        <section className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white">
                            <header className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
                                {beforeLabel}
                            </header>
                            <div
                                ref={diffBeforePaneRef}
                                onScroll={() => syncDiffVerticalScroll('before')}
                                className="max-h-[62vh] overflow-auto"
                            >
                                <table className="w-max min-w-full border-collapse text-left text-xs">
                                    <tbody>
                                        {renderEntries.map((entry) => {
                                            if (entry.kind === 'collapsed') {
                                                return (
                                                    <tr key={`before-${entry.key}`}>
                                                        <td
                                                            colSpan={2}
                                                            className="border-y border-slate-200 bg-slate-100 px-3 py-1 text-center text-[11px] font-semibold text-slate-500"
                                                        >
                                                            {entry.hiddenCount} unchanged line{entry.hiddenCount === 1 ? '' : 's'} collapsed
                                                        </td>
                                                    </tr>
                                                );
                                            }

                                            const row = entry.row;
                                            const rowIndex = entry.index;
                                            return (
                                                <tr key={`json-diff-before-row-${rowIndex}`} className="align-top">
                                                    <td className={`w-12 border-r border-slate-100 px-2 py-0.5 text-right font-mono text-[10px] ${lineCellClassName(row.leftType)}`}>
                                                        {row.leftLineNumber ?? ''}
                                                    </td>
                                                    <td className={`min-w-[420px] px-2 py-0.5 font-mono ${lineCellClassName(row.leftType)} ${JSON_TOKEN_CLASSNAMES}`}>
                                                        <code
                                                            className="whitespace-pre"
                                                            dangerouslySetInnerHTML={{ __html: highlightJsonLine(row.leftValue) }}
                                                        />
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </section>

                        <section className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white">
                            <header className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
                                {afterLabel}
                            </header>
                            <div
                                ref={diffAfterPaneRef}
                                onScroll={() => syncDiffVerticalScroll('after')}
                                className="max-h-[62vh] overflow-auto"
                            >
                                <table className="w-max min-w-full border-collapse text-left text-xs">
                                    <tbody>
                                        {renderEntries.map((entry) => {
                                            if (entry.kind === 'collapsed') {
                                                return (
                                                    <tr key={`after-${entry.key}`}>
                                                        <td
                                                            colSpan={2}
                                                            className="border-y border-slate-200 bg-slate-100 px-3 py-1 text-center text-[11px] font-semibold text-slate-500"
                                                        >
                                                            {entry.hiddenCount} unchanged line{entry.hiddenCount === 1 ? '' : 's'} collapsed
                                                        </td>
                                                    </tr>
                                                );
                                            }

                                            const row = entry.row;
                                            const rowIndex = entry.index;
                                            return (
                                                <tr key={`json-diff-after-row-${rowIndex}`} className="align-top">
                                                    <td className={`w-12 border-r border-slate-100 px-2 py-0.5 text-right font-mono text-[10px] ${lineCellClassName(row.rightType)}`}>
                                                        {row.rightLineNumber ?? ''}
                                                    </td>
                                                    <td className={`min-w-[420px] px-2 py-0.5 font-mono ${lineCellClassName(row.rightType)} ${JSON_TOKEN_CLASSNAMES}`}>
                                                        <code
                                                            className="whitespace-pre"
                                                            dangerouslySetInnerHTML={{ __html: highlightJsonLine(row.rightValue) }}
                                                        />
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </section>
                    </div>
                </>
            )}
        </AppModal>
    );
};
