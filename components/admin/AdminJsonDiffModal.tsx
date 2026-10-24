import React, { useEffect, useMemo, useRef, useState } from 'react';
import { SpinnerGap, Warning } from '@phosphor-icons/react';
import Prism from 'prismjs';
if (typeof window !== 'undefined') {
    (window as any).Prism = (window as any).Prism || Prism;
}
import 'prismjs/components/prism-json';
import { AppModal } from '../ui/app-modal';
import { Alert, AlertDescription } from '../ui/alert';
import { Badge } from '../ui/badge';
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
    if (type === 'removed') return 'bg-rose-50 text-rose-900 dark:bg-rose-400/12 dark:text-rose-200';
    if (type === 'added') return 'bg-emerald-50 text-emerald-900 dark:bg-emerald-400/12 dark:text-emerald-200';
    if (type === 'empty') return 'bg-secondary text-muted-foreground/50';
    return 'bg-card text-foreground';
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
    const changedIndices = rows.flatMap((row, index) => (
        isChangedRow(row) ? [index] : []
    ));

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

const formatJsonTokenStream = (
    tokens: Array<string | Prism.Token>,
    keyPrefix: string
): React.ReactNode[] => tokens.map((token, index) => {
    if (typeof token === 'string') {
        return <React.Fragment key={`${keyPrefix}-text-${index}-${token.length}`}>{token}</React.Fragment>;
    }

    const aliases = Array.isArray(token.alias)
        ? token.alias
        : token.alias
            ? [token.alias]
            : [];
    const className = ['token', token.type, ...aliases].join(' ');
    const content = Array.isArray(token.content)
        ? formatJsonTokenStream(token.content as Array<string | Prism.Token>, `${keyPrefix}-${index}-${token.type}`)
        : token.content;

    return (
        <span key={`${keyPrefix}-${index}-${token.type}`} className={className}>
            {content}
        </span>
    );
});

const formatJsonLine = (value: string | null, keyPrefix: string): React.ReactNode => {
    if (value === null) return null;
    return formatJsonTokenStream(Prism.tokenize(value || ' ', Prism.languages.json), keyPrefix);
};

const JSON_TOKEN_CLASSNAMES = [
    '[&_.token.property]:!text-sky-700 dark:[&_.token.property]:!text-sky-200',
    '[&_.token.string]:!text-emerald-700 dark:[&_.token.string]:!text-emerald-200',
    '[&_.token.number]:!text-fuchsia-700 dark:[&_.token.number]:!text-fuchsia-200',
    '[&_.token.boolean]:!text-amber-700 dark:[&_.token.boolean]:!text-amber-200',
    '[&_.token.null]:!text-muted-foreground',
    '[&_.token.punctuation]:!text-muted-foreground',
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
            bodyClassName="flex flex-col gap-3 overflow-y-auto p-4"
            closeLabel="Close diff modal"
        >
            {errorMessage && (
                <Alert variant="warning">
                    <Warning weight="fill" />
                    <AlertDescription>
                        <p>{errorMessage}</p>
                    </AlertDescription>
                </Alert>
            )}
            {isLoading ? (
                <div role="status" className="inline-flex w-fit items-center gap-2 rounded-md border border-border bg-secondary px-3 py-2 text-sm text-muted-foreground">
                    <SpinnerGap size={14} className="animate-spin" />
                    Loading snapshots…
                </div>
            ) : (
                <>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="secondary" className="tabular-nums">
                                {diff.changedRowCount} changed line{diff.changedRowCount === 1 ? '' : 's'}
                            </Badge>
                            <Badge variant="outline" className="tabular-nums">
                                {diff.rows.length} total line{diff.rows.length === 1 ? '' : 's'}
                            </Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <label className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-md border border-border bg-card px-3 text-xs font-medium text-foreground">
                                <Checkbox
                                    checked={!focusedOnly}
                                    onCheckedChange={(checked) => setFocusedOnly(!Boolean(checked))}
                                    aria-label="Show full diff"
                                />
                                Show full diff
                            </label>
                        </div>
                    </div>

                    {focusedOnly && (
                        <p className="text-xs text-muted-foreground">
                            Showing focused context around changed lines
                        </p>
                    )}

                    <div className="grid grid-cols-1 gap-1 lg:grid-cols-2">
                        <section className="min-w-0 overflow-hidden rounded-lg border border-border bg-card">
                            <header className="border-b border-border bg-muted/50 px-3 py-2 text-xs font-medium text-foreground">
                                {beforeLabel}
                            </header>
                            <div
                                ref={diffBeforePaneRef}
                                onScroll={() => syncDiffVerticalScroll('before')}
                                className="max-h-[62vh] overflow-auto"
                            >
                                <table className="w-max min-w-full border-collapse text-start text-xs">
                                    <tbody>
                                        {renderEntries.map((entry) => {
                                            if (entry.kind === 'collapsed') {
                                                return (
                                                    <tr key={`before-${entry.key}`}>
                                                        <td
                                                            colSpan={2}
                                                            className="border-y border-border bg-secondary px-3 py-1 text-center text-[11px] font-medium text-muted-foreground"
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
                                                    <td className={`w-12 border-e border-border px-2 py-0.5 text-end font-mono tabular-nums text-[10px] ${lineCellClassName(row.leftType)}`}>
                                                        {row.leftLineNumber ?? ''}
                                                    </td>
                                                    <td className={`min-w-[420px] px-2 py-0.5 font-mono ${lineCellClassName(row.leftType)} ${JSON_TOKEN_CLASSNAMES}`}>
                                                        <code className="whitespace-pre">
                                                            {formatJsonLine(row.leftValue, `before-${rowIndex}`)}
                                                        </code>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </section>

                        <section className="min-w-0 overflow-hidden rounded-lg border border-border bg-card">
                            <header className="border-b border-border bg-muted/50 px-3 py-2 text-xs font-medium text-foreground">
                                {afterLabel}
                            </header>
                            <div
                                ref={diffAfterPaneRef}
                                onScroll={() => syncDiffVerticalScroll('after')}
                                className="max-h-[62vh] overflow-auto"
                            >
                                <table className="w-max min-w-full border-collapse text-start text-xs">
                                    <tbody>
                                        {renderEntries.map((entry) => {
                                            if (entry.kind === 'collapsed') {
                                                return (
                                                    <tr key={`after-${entry.key}`}>
                                                        <td
                                                            colSpan={2}
                                                            className="border-y border-border bg-secondary px-3 py-1 text-center text-[11px] font-medium text-muted-foreground"
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
                                                    <td className={`w-12 border-e border-border px-2 py-0.5 text-end font-mono tabular-nums text-[10px] ${lineCellClassName(row.rightType)}`}>
                                                        {row.rightLineNumber ?? ''}
                                                    </td>
                                                    <td className={`min-w-[420px] px-2 py-0.5 font-mono ${lineCellClassName(row.rightType)} ${JSON_TOKEN_CLASSNAMES}`}>
                                                        <code className="whitespace-pre">
                                                            {formatJsonLine(row.rightValue, `after-${rowIndex}`)}
                                                        </code>
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
