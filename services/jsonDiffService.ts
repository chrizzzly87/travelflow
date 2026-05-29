import { parseDiffFromFile, type FileDiffMetadata } from '@pierre/diffs';

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

const pushRowsFromDiffMetadata = (rows: JsonDiffRow[], diff: FileDiffMetadata): void => {
    diff.hunks.forEach((hunk) => {
        hunk.hunkContent.forEach((content) => {
            if (content.type === 'context') {
                for (let lineIndex = 0; lineIndex < content.lines; lineIndex += 1) {
                    const leftIndex = content.deletionLineIndex + lineIndex;
                    const rightIndex = content.additionLineIndex + lineIndex;
                    const leftValue = stripLineBreak(diff.deletionLines[leftIndex]);
                    const rightValue = stripLineBreak(diff.additionLines[rightIndex]);
                    rows.push({
                        leftLineNumber: leftIndex + 1,
                        rightLineNumber: rightIndex + 1,
                        leftValue,
                        rightValue,
                        leftType: 'context',
                        rightType: 'context',
                    });
                }
                return;
            }

            const maxLength = Math.max(content.deletions, content.additions);
            for (let lineIndex = 0; lineIndex < maxLength; lineIndex += 1) {
                const leftIndex = content.deletionLineIndex + lineIndex;
                const rightIndex = content.additionLineIndex + lineIndex;
                const hasRemovedLine = lineIndex < content.deletions;
                const hasAddedLine = lineIndex < content.additions;
                rows.push({
                    leftLineNumber: hasRemovedLine ? leftIndex + 1 : null,
                    rightLineNumber: hasAddedLine ? rightIndex + 1 : null,
                    leftValue: hasRemovedLine ? stripLineBreak(diff.deletionLines[leftIndex]) : null,
                    rightValue: hasAddedLine ? stripLineBreak(diff.additionLines[rightIndex]) : null,
                    leftType: hasRemovedLine ? 'removed' : 'empty',
                    rightType: hasAddedLine ? 'added' : 'empty',
                });
            }
        });
    });
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
        const diff = parseDiffFromFile(
            { name: 'snapshot.json', contents: beforeText },
            { name: 'snapshot.json', contents: afterText },
            { context: Number.MAX_SAFE_INTEGER }
        );
        pushRowsFromDiffMetadata(rows, diff);
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
