import { diffLines, type Change } from 'diff';

export type JsonDiffLineType = 'context' | 'added' | 'removed' | 'empty';

export interface JsonDiffRow {
    leftLineNumber: number | null;
    rightLineNumber: number | null;
    leftValue: string | null;
    rightValue: string | null;
    leftType: JsonDiffLineType;
    rightType: JsonDiffLineType;
}

export interface JsonDiffResult {
    beforeText: string;
    afterText: string;
    rows: JsonDiffRow[];
    changedRowCount: number;
}

const toJsonText = (value: unknown): string => JSON.stringify(value ?? null, null, 2);

const splitLines = (value: string): string[] => {
    const normalized = value.replace(/\r\n/g, '\n');
    const lines = normalized.split('\n');
    if (lines.length > 0 && lines[lines.length - 1] === '') {
        lines.pop();
    }
    return lines;
};

const hasLineAt = (lines: string[], index: number): boolean => index >= 0 && index < lines.length;

const pushRemovedAddedRows = (
    rows: JsonDiffRow[],
    removedLines: string[],
    addedLines: string[],
    counters: { left: number; right: number }
) => {
    const maxLength = Math.max(removedLines.length, addedLines.length);
    for (let lineIndex = 0; lineIndex < maxLength; lineIndex += 1) {
        const hasRemovedLine = hasLineAt(removedLines, lineIndex);
        const hasAddedLine = hasLineAt(addedLines, lineIndex);
        rows.push({
            leftLineNumber: hasRemovedLine ? counters.left : null,
            rightLineNumber: hasAddedLine ? counters.right : null,
            leftValue: hasRemovedLine ? removedLines[lineIndex] ?? '' : null,
            rightValue: hasAddedLine ? addedLines[lineIndex] ?? '' : null,
            leftType: hasRemovedLine ? 'removed' : 'empty',
            rightType: hasAddedLine ? 'added' : 'empty',
        });
        if (hasRemovedLine) counters.left += 1;
        if (hasAddedLine) counters.right += 1;
    }
};

const pushSingleSidedRows = (
    rows: JsonDiffRow[],
    lines: string[],
    side: 'left' | 'right',
    lineType: JsonDiffLineType,
    counters: { left: number; right: number }
) => {
    lines.forEach((line) => {
        if (side === 'left') {
            rows.push({
                leftLineNumber: counters.left,
                rightLineNumber: null,
                leftValue: line,
                rightValue: null,
                leftType: lineType,
                rightType: 'empty',
            });
            counters.left += 1;
            return;
        }

        rows.push({
            leftLineNumber: null,
            rightLineNumber: counters.right,
            leftValue: null,
            rightValue: line,
            leftType: 'empty',
            rightType: lineType,
        });
        counters.right += 1;
    });
};

const pushContextRows = (
    rows: JsonDiffRow[],
    lines: string[],
    counters: { left: number; right: number }
) => {
    lines.forEach((line) => {
        rows.push({
            leftLineNumber: counters.left,
            rightLineNumber: counters.right,
            leftValue: line,
            rightValue: line,
            leftType: 'context',
            rightType: 'context',
        });
        counters.left += 1;
        counters.right += 1;
    });
};

export const buildSideBySideJsonDiff = (
    beforeValue: unknown,
    afterValue: unknown
): JsonDiffResult => {
    const beforeText = toJsonText(beforeValue);
    const afterText = toJsonText(afterValue);
    const changes = diffLines(beforeText, afterText) as Change[];
    const rows: JsonDiffRow[] = [];
    const counters = { left: 1, right: 1 };

    for (let changeIndex = 0; changeIndex < changes.length; changeIndex += 1) {
        const change = changes[changeIndex];
        const next = changeIndex + 1 < changes.length ? changes[changeIndex + 1] : null;
        if (!change) continue;

        if (change.removed && next?.added) {
            pushRemovedAddedRows(
                rows,
                splitLines(change.value),
                splitLines(next.value),
                counters
            );
            changeIndex += 1;
            continue;
        }

        if (change.removed) {
            pushSingleSidedRows(rows, splitLines(change.value), 'left', 'removed', counters);
            continue;
        }

        if (change.added) {
            pushSingleSidedRows(rows, splitLines(change.value), 'right', 'added', counters);
            continue;
        }

        pushContextRows(rows, splitLines(change.value), counters);
    }

    const changedRowCount = rows.reduce((count, row) => {
        if (row.leftType === 'context' && row.rightType === 'context') return count;
        return count + 1;
    }, 0);

    return {
        beforeText,
        afterText,
        rows,
        changedRowCount,
    };
};
