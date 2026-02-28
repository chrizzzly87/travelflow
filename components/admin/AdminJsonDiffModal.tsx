import React, { useMemo } from 'react';
import { SpinnerGap } from '@phosphor-icons/react';
import { AppModal } from '../ui/app-modal';
import { buildSideBySideJsonDiff, type JsonDiffLineType } from '../../services/jsonDiffService';

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
    const diff = useMemo(
        () => buildSideBySideJsonDiff(beforeValue, afterValue),
        [beforeValue, afterValue]
    );

    return (
        <AppModal
            isOpen={isOpen}
            onClose={onClose}
            title={title}
            description={description}
            size="xl"
            contentClassName="sm:w-[min(96vw,1180px)]"
            bodyClassName="space-y-3 overflow-hidden p-4"
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
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
                        <span className="inline-flex rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">
                            {diff.changedRowCount} changed line{diff.changedRowCount === 1 ? '' : 's'}
                        </span>
                        <span className="inline-flex rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">
                            {diff.rows.length} total line{diff.rows.length === 1 ? '' : 's'}
                        </span>
                    </div>

                    <div className="grid gap-3 lg:grid-cols-2">
                        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
                            {beforeLabel}
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
                            {afterLabel}
                        </div>
                    </div>

                    <div className="max-h-[62vh] overflow-auto rounded-xl border border-slate-200">
                        <table className="min-w-full border-collapse text-left text-xs">
                            <tbody>
                                {diff.rows.map((row, rowIndex) => (
                                    <tr key={`json-diff-row-${rowIndex}`} className="align-top">
                                        <td className={`w-12 border-r border-slate-100 px-2 py-0.5 text-right font-mono text-[10px] ${lineCellClassName(row.leftType)}`}>
                                            {row.leftLineNumber ?? ''}
                                        </td>
                                        <td className={`w-1/2 border-r border-slate-100 px-2 py-0.5 font-mono ${lineCellClassName(row.leftType)}`}>
                                            <span className="whitespace-pre">{row.leftValue ?? ''}</span>
                                        </td>
                                        <td className={`w-12 border-r border-slate-100 px-2 py-0.5 text-right font-mono text-[10px] ${lineCellClassName(row.rightType)}`}>
                                            {row.rightLineNumber ?? ''}
                                        </td>
                                        <td className={`w-1/2 px-2 py-0.5 font-mono ${lineCellClassName(row.rightType)}`}>
                                            <span className="whitespace-pre">{row.rightValue ?? ''}</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </AppModal>
    );
};

