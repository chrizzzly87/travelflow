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

const stripLineBreak = (value: string | undefined): string => value?.replace(/\r?\n$/, '') ?? '';

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

const pushChangedRows = (
    rows: JsonDiffRow[],
    removedLines: string[],
    addedLines: string[],
    counters: { left: number; right: number }
): void => {
    const maxLength = Math.max(removedLines.length, addedLines.length);
    for (let lineIndex = 0; lineIndex < maxLength; lineIndex += 1) {
        const hasRemovedLine = lineIndex < removedLines.length;
        const hasAddedLine = lineIndex < addedLines.length;
        rows.push({
            leftLineNumber: hasRemovedLine ? counters.left : null,
            rightLineNumber: hasAddedLine ? counters.right : null,
            leftValue: hasRemovedLine ? stripLineBreak(removedLines[lineIndex]) : null,
            rightValue: hasAddedLine ? stripLineBreak(addedLines[lineIndex]) : null,
            leftType: hasRemovedLine ? 'removed' : 'empty',
            rightType: hasAddedLine ? 'added' : 'empty',
        });
        if (hasRemovedLine) counters.left += 1;
        if (hasAddedLine) counters.right += 1;
    }
};

const pushRowsFromLineChanges = (rows: JsonDiffRow[], changes: Change[]): void => {
    const counters = { left: 1, right: 1 };

    for (let changeIndex = 0; changeIndex < changes.length; changeIndex += 1) {
        const change = changes[changeIndex];
        const lines = splitLines(change.value);

        if (!change.added && !change.removed) {
            pushContextRows(rows, lines, counters);
            continue;
        }

        if (change.removed && changes[changeIndex + 1]?.added) {
            pushChangedRows(rows, lines, splitLines(changes[changeIndex + 1].value), counters);
            changeIndex += 1;
            continue;
        }

        pushChangedRows(rows, change.removed ? lines : [], change.added ? lines : [], counters);
    }
};

export const buildSideBySideJsonDiff = (
    beforeValue: unknown,
    afterValue: unknown
): JsonDiffResult => {
    const beforeText = toJsonText(beforeValue);
    const afterText = toJsonText(afterValue);
    const rows: JsonDiffRow[] = [];

    if (beforeText === afterText) {
        pushContextRows(rows, splitLines(beforeText), { left: 1, right: 1 });
    } else {
        pushRowsFromLineChanges(rows, diffLines(beforeText, afterText));
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
