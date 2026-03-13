import type { Content, Heading, List, ListItem, Root } from 'mdast';

export const TASK_CHECKBOX_LINE_REGEX = /^(\s*(?:>\s*)*(?:[-*+]|\d+[.)])\s+\[)( |x|X)(\].*)$/;
const HEADING_LINE_REGEX = /^(#{1,6})\s+(.*)$/;

export const MARKDOWN_H1_CLASS = 'mt-4 mb-2 border-t border-gray-100 pt-2 text-base font-black tracking-tight text-gray-800 first:mt-0 first:border-t-0 first:pt-0';
export const MARKDOWN_H2_CLASS = 'mt-4 mb-2 border-t border-gray-100 pt-2 text-sm font-extrabold tracking-wide text-gray-800 first:mt-0 first:border-t-0 first:pt-0';
export const MARKDOWN_H3_CLASS = 'mt-4 mb-2 border-t border-gray-100 pt-2 text-sm font-black tracking-wide text-gray-800 first:mt-0 first:border-t-0 first:pt-0';
export const MARKDOWN_TASK_LIST_CLASS = 'my-2 space-y-2 ps-0';
export const MARKDOWN_TASK_ITEM_CLASS = 'list-none ps-0';
export const MARKDOWN_TASK_ROW_CLASS = 'flex items-start gap-3';
export const MARKDOWN_TASK_TEXT_CLASS = 'min-w-0 flex-1 leading-6 text-slate-700 [&_p]:m-0';
export const MARKDOWN_HEADS_UP_LIST_CLASS = 'my-2 space-y-2 ps-0';
export const MARKDOWN_HEADS_UP_BANNER_CLASS = 'list-none rounded-lg border border-slate-200 bg-slate-100/85 px-3 py-2 text-sm leading-6 text-slate-700 [&_p]:m-0';

const getNodeText = (node: Content | Heading['children'][number]): string => {
    if ('value' in node && typeof node.value === 'string') return node.value;
    if ('children' in node && Array.isArray(node.children)) {
        return node.children.map((child) => getNodeText(child as Heading['children'][number])).join('');
    }
    return '';
};

const setHProperty = (node: { data?: { hProperties?: Record<string, unknown> } }, key: string, value: string) => {
    node.data = node.data || {};
    node.data.hProperties = {
        ...(node.data.hProperties || {}),
        [key]: value,
    };
};

export const isHeadsUpHeading = (heading: string): boolean => heading.trim().toLowerCase() === 'heads up';

export const findMarkdownTaskLineNumbers = (markdown: string): number[] => (
    markdown
        .split('\n')
        .map((line, index) => (TASK_CHECKBOX_LINE_REGEX.test(line) ? index + 1 : -1))
        .filter((lineNumber) => lineNumber > 0)
);

export const toggleMarkdownTaskByLine = (markdown: string, lineNumber: number, checked: boolean): string | null => {
    const lines = markdown.split('\n');
    const lineIndex = lineNumber - 1;
    if (lineIndex < 0 || lineIndex >= lines.length) return null;

    const currentLine = lines[lineIndex];
    if (!currentLine || !TASK_CHECKBOX_LINE_REGEX.test(currentLine)) return null;

    const nextLine = currentLine.replace(
        TASK_CHECKBOX_LINE_REGEX,
        `$1${checked ? 'x' : ' '}$3`,
    );
    if (nextLine === currentLine) return null;

    lines[lineIndex] = nextLine;
    return lines.join('\n');
};

export const toggleMarkdownTaskByIndex = (markdown: string, taskIndex: number, checked: boolean): string | null => {
    const lineNumber = findMarkdownTaskLineNumbers(markdown)[taskIndex];
    if (typeof lineNumber !== 'number') return null;
    return toggleMarkdownTaskByLine(markdown, lineNumber, checked);
};

export const normalizeHeadsUpMarkdownForDisplay = (markdown: string): string => {
    const lines = markdown.replace(/\r\n/g, '\n').split('\n');
    const transformed: string[] = [];
    let insideHeadsUp = false;

    for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index] || '';
        const headingMatch = line.match(HEADING_LINE_REGEX);
        if (headingMatch) {
            insideHeadsUp = isHeadsUpHeading(headingMatch[2]);
            transformed.push(line);
            continue;
        }

        if (!insideHeadsUp) {
            transformed.push(line);
            continue;
        }

        const taskMatch = line.match(/^\s*(?:[-*+]|\d+[.)])\s+\[(?: |x|X)\]\s+(.*)$/);
        const bulletMatch = line.match(/^\s*(?:[-*+]|\d+[.)])\s+(.*)$/);
        const content = taskMatch?.[1] || bulletMatch?.[1];

        if (content) {
            if (transformed.length > 0 && transformed[transformed.length - 1].trim() !== '') {
                transformed.push('');
            }
            transformed.push(`> ${content.trim()}`);
            transformed.push('');
            continue;
        }

        transformed.push(line);
    }

    return transformed.join('\n').replace(/\n{3,}/g, '\n\n');
};

export const remarkHeadsUpBanners = () => (tree: Root) => {
    let insideHeadsUp = false;

    tree.children.forEach((child) => {
        if (child.type === 'heading') {
            insideHeadsUp = isHeadsUpHeading(getNodeText(child).trim());
            return;
        }

        if (!insideHeadsUp) return;
        if (child.type !== 'list') return;

        setHProperty(child as List, 'data-heads-up-list', 'true');

        child.children.forEach((listItem) => {
            listItem.checked = null;
            setHProperty(listItem as ListItem, 'data-heads-up-banner', 'true');
        });
    });
};
