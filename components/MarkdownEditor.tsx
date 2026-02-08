import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Bot, Sparkles, Bold, Italic, List, CheckSquare, Heading1, Heading2, Heading3, Link2 } from 'lucide-react';
import { useAppDialog } from './AppDialogProvider';

export interface MarkdownAiAction {
    id: string;
    label: string;
    description: string;
}

interface MarkdownEditorProps {
    value: string;
    onChange?: (value: string) => void;
    onAiGenerate?: () => void;
    onAiActionSelect?: (actionId: string) => void;
    aiActions?: MarkdownAiAction[];
    aiStatus?: string | null;
    isGenerating?: boolean;
    readOnly?: boolean;
    className?: string;
}

const TASK_CHECKBOX_LINE_REGEX = /^(\s*(?:>\s*)*(?:[-*+]|\d+[.)])\s+\[)( |x|X)(\].*)$/;
const HEADING_REGEX = /^(#{1,3})\s+(.*)$/;
const BULLET_REGEX = /^\s*[-*+]\s+(.*)$/;
const ORDERED_REGEX = /^\s*\d+[.)]\s+(.*)$/;
const TASK_REGEX = /^\s*(?:[-*+]|\d+[.)])\s+\[( |x|X)\]\s+(.*)$/;

const H1_CLASS = "mt-4 mb-2 pt-2 text-base font-black tracking-tight text-gray-800 border-t border-gray-100 first:mt-0 first:pt-0 first:border-t-0";
const H2_CLASS = "mt-4 mb-2 pt-2 text-sm font-extrabold tracking-wide text-gray-800 border-t border-gray-100 first:mt-0 first:pt-0 first:border-t-0";
const H3_CLASS = "mt-4 mb-2 pt-2 text-xs font-extrabold uppercase tracking-wide text-gray-700 border-t border-gray-100 first:mt-0 first:pt-0 first:border-t-0";

const escapeHtml = (input: string): string => {
    return input
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
};

const inlineMarkdownToHtml = (input: string): string => {
    let text = escapeHtml(input);

    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label, href) => {
        return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
    });

    text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');

    return text;
};

const findTaskLineNumbers = (markdown: string): number[] => {
    return markdown
        .split('\n')
        .map((line, index) => (TASK_CHECKBOX_LINE_REGEX.test(line) ? index + 1 : -1))
        .filter((lineNumber) => lineNumber > 0);
};

const toggleTaskCheckboxByLine = (markdown: string, lineNumber: number, checked: boolean): string => {
    const lines = markdown.split('\n');
    const lineIndex = lineNumber - 1;
    if (lineIndex < 0 || lineIndex >= lines.length) return markdown;

    const line = lines[lineIndex];
    if (!TASK_CHECKBOX_LINE_REGEX.test(line)) return markdown;

    lines[lineIndex] = line.replace(TASK_CHECKBOX_LINE_REGEX, `$1${checked ? 'x' : ' '}$3`);
    return lines.join('\n');
};

const toggleTaskCheckboxByTaskIndex = (markdown: string, taskIndex: number, checked: boolean): string => {
    const taskLineNumbers = findTaskLineNumbers(markdown);
    const lineNumber = taskLineNumbers[taskIndex];
    if (typeof lineNumber !== 'number') return markdown;
    return toggleTaskCheckboxByLine(markdown, lineNumber, checked);
};

const markdownToHtml = (markdown: string): string => {
    const lines = markdown.replace(/\r\n/g, '\n').split('\n');
    const blocks: string[] = [];

    let i = 0;
    while (i < lines.length) {
        const rawLine = lines[i];
        const line = rawLine || '';

        if (!line.trim()) {
            i += 1;
            continue;
        }

        const headingMatch = line.match(HEADING_REGEX);
        if (headingMatch) {
            const level = Math.min(3, headingMatch[1].length);
            blocks.push(`<h${level}>${inlineMarkdownToHtml(headingMatch[2].trim())}</h${level}>`);
            i += 1;
            continue;
        }

        const taskMatch = line.match(TASK_REGEX);
        const bulletMatch = line.match(BULLET_REGEX);
        const orderedMatch = line.match(ORDERED_REGEX);

        if (taskMatch || bulletMatch || orderedMatch) {
            const isOrderedList = !!orderedMatch && !taskMatch;
            const listTag = isOrderedList ? 'ol' : 'ul';
            const items: string[] = [];

            while (i < lines.length) {
                const currentLine = lines[i] || '';
                if (!currentLine.trim()) break;

                const currentTask = currentLine.match(TASK_REGEX);
                const currentBullet = currentLine.match(BULLET_REGEX);
                const currentOrdered = currentLine.match(ORDERED_REGEX);

                if (currentTask) {
                    const checked = currentTask[1].toLowerCase() === 'x';
                    const content = inlineMarkdownToHtml(currentTask[2]);
                    items.push(`<li><input type="checkbox" ${checked ? 'checked' : ''} contenteditable="false" /> ${content}</li>`);
                    i += 1;
                    continue;
                }

                if (isOrderedList && currentOrdered) {
                    items.push(`<li>${inlineMarkdownToHtml(currentOrdered[1])}</li>`);
                    i += 1;
                    continue;
                }

                if (!isOrderedList && currentBullet) {
                    items.push(`<li>${inlineMarkdownToHtml(currentBullet[1])}</li>`);
                    i += 1;
                    continue;
                }

                break;
            }

            blocks.push(`<${listTag}>${items.join('')}</${listTag}>`);
            continue;
        }

        const paragraphLines: string[] = [];
        while (i < lines.length) {
            const currentLine = lines[i] || '';
            if (!currentLine.trim()) break;
            if (HEADING_REGEX.test(currentLine) || TASK_REGEX.test(currentLine) || BULLET_REGEX.test(currentLine) || ORDERED_REGEX.test(currentLine)) {
                break;
            }

            paragraphLines.push(inlineMarkdownToHtml(currentLine.trim()));
            i += 1;
        }

        blocks.push(`<p>${paragraphLines.join('<br/>')}</p>`);
    }

    return blocks.join('');
};

const normalizeMarkdownOutput = (markdown: string): string => {
    return markdown
        .replace(/\u00a0/g, ' ')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
};

const serializeInlineNode = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) {
        return (node.textContent || '').replace(/\u00a0/g, ' ');
    }

    if (!(node instanceof HTMLElement)) {
        return '';
    }

    const tag = node.tagName.toLowerCase();

    if (tag === 'strong' || tag === 'b') {
        return `**${serializeInlineChildren(node)}**`;
    }

    if (tag === 'em' || tag === 'i') {
        return `*${serializeInlineChildren(node)}*`;
    }

    if (tag === 'a') {
        const href = node.getAttribute('href') || '';
        const label = serializeInlineChildren(node).trim() || href;
        if (!href) return label;
        return `[${label}](${href})`;
    }

    if (tag === 'br') {
        return '\n';
    }

    if (tag === 'input' && (node as HTMLInputElement).type === 'checkbox') {
        return '';
    }

    return serializeInlineChildren(node);
};

const serializeInlineChildren = (element: HTMLElement, skipNode?: Node): string => {
    return Array.from(element.childNodes)
        .map((child) => {
            if (skipNode && child === skipNode) return '';
            return serializeInlineNode(child);
        })
        .join('')
        .replace(/\s+\n/g, '\n')
        .replace(/\n\s+/g, '\n');
};

const serializeList = (listElement: HTMLOListElement | HTMLUListElement, ordered: boolean): string => {
    const lines = Array.from(listElement.children)
        .filter((child): child is HTMLLIElement => child instanceof HTMLLIElement)
        .map((li, index) => {
            const directCheckbox = Array.from(li.childNodes).find(
                (child): child is HTMLInputElement => child instanceof HTMLInputElement && child.type === 'checkbox'
            );

            const content = serializeInlineChildren(li, directCheckbox).trim();

            if (directCheckbox) {
                return `- [${directCheckbox.checked ? 'x' : ' '}] ${content}`.trimEnd();
            }

            if (ordered) {
                return `${index + 1}. ${content}`.trimEnd();
            }

            return `- ${content}`.trimEnd();
        })
        .filter((line) => line.trim().length > 0);

    return lines.join('\n');
};

const serializeBlockNode = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) {
        const text = (node.textContent || '').replace(/\u00a0/g, ' ').trim();
        return text;
    }

    if (!(node instanceof HTMLElement)) {
        return '';
    }

    const tag = node.tagName.toLowerCase();

    if (tag === 'h1') return `# ${serializeInlineChildren(node).trim()}`;
    if (tag === 'h2') return `## ${serializeInlineChildren(node).trim()}`;
    if (tag === 'h3') return `### ${serializeInlineChildren(node).trim()}`;
    if (tag === 'p') return serializeInlineChildren(node).trim();
    if (tag === 'ul') return serializeList(node as HTMLUListElement, false);
    if (tag === 'ol') return serializeList(node as HTMLOListElement, true);

    if (tag === 'div') {
        const children = Array.from(node.childNodes)
            .map((child) => serializeBlockNode(child))
            .filter((line) => line.trim().length > 0);

        if (children.length > 0) {
            return children.join('\n');
        }

        return serializeInlineChildren(node).trim();
    }

    if (tag === 'br') return '';

    return serializeInlineChildren(node).trim();
};

const htmlToMarkdown = (root: HTMLElement): string => {
    const blockLines = Array.from(root.childNodes)
        .map((node) => serializeBlockNode(node))
        .filter((line) => line.trim().length > 0);

    if (blockLines.length === 0) {
        return normalizeMarkdownOutput(root.textContent || '');
    }

    return normalizeMarkdownOutput(blockLines.join('\n\n'));
};

export const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
    value,
    onChange,
    onAiGenerate,
    onAiActionSelect,
    aiActions,
    aiStatus,
    isGenerating = false,
    readOnly = false,
    className = ''
}) => {
    const { prompt } = useAppDialog();
    const [isAiPopoverOpen, setIsAiPopoverOpen] = useState(false);

    const aiPopoverRef = useRef<HTMLDivElement>(null);
    const editorRef = useRef<HTMLDivElement>(null);
    const isApplyingExternalValueRef = useRef(false);

    const hasAiActions = !!onAiActionSelect && !!aiActions && aiActions.length > 0;
    const hasAiButton = !!onAiGenerate || hasAiActions;
    const isEditorInteractive = !readOnly && !!onChange;

    useEffect(() => {
        if (!isAiPopoverOpen) return;

        const handleClickOutside = (event: MouseEvent) => {
            if (!aiPopoverRef.current) return;
            const target = event.target as Node | null;
            if (target && !aiPopoverRef.current.contains(target)) {
                setIsAiPopoverOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isAiPopoverOpen]);

    useEffect(() => {
        if (isGenerating) {
            setIsAiPopoverOpen(false);
        }
    }, [isGenerating]);

    useEffect(() => {
        if (readOnly) return;
        const editor = editorRef.current;
        if (!editor) return;

        const currentMarkdown = htmlToMarkdown(editor);
        if (currentMarkdown === value) return;

        const html = markdownToHtml(value);

        isApplyingExternalValueRef.current = true;
        editor.innerHTML = html || '<p><br/></p>';
        isApplyingExternalValueRef.current = false;
    }, [value, readOnly]);

    const syncMarkdownFromEditor = () => {
        if (!onChange || !editorRef.current || isApplyingExternalValueRef.current) return;
        const nextMarkdown = htmlToMarkdown(editorRef.current);
        if (nextMarkdown !== value) {
            onChange(nextMarkdown);
        }
    };

    const focusEditor = () => {
        editorRef.current?.focus();
    };

    const runCommand = (command: string, commandValue?: string) => {
        focusEditor();
        document.execCommand(command, false, commandValue);
        syncMarkdownFromEditor();
    };

    const handleHeading = (level: 1 | 2 | 3) => {
        runCommand('formatBlock', `<h${level}>`);
    };

    const handleChecklist = () => {
        focusEditor();
        document.execCommand('insertHTML', false, '<ul><li><input type="checkbox" contenteditable="false" /> New item</li></ul>');
        syncMarkdownFromEditor();
    };

    const handleLink = async () => {
        focusEditor();
        const selection = window.getSelection();
        const selectedText = selection?.toString().trim() || '';
        const selectionRange = selection && selection.rangeCount > 0 ? selection.getRangeAt(0).cloneRange() : null;

        const url = await prompt({
            title: 'Insert Link',
            message: 'Enter a URL for the selected text or insert a new link.',
            label: 'URL',
            placeholder: 'https://example.com',
            defaultValue: 'https://',
            confirmLabel: 'Insert Link',
            cancelLabel: 'Cancel',
            inputType: 'url',
            validate: (value) => {
                if (!value) return 'Please enter a URL.';
                try {
                    const parsed = new URL(value);
                    if (!parsed.protocol.startsWith('http')) {
                        return 'URL must start with http:// or https://';
                    }
                    return null;
                } catch {
                    return 'Please enter a valid URL.';
                }
            },
        });
        if (!url) return;

        focusEditor();
        if (selectionRange) {
            const nextSelection = window.getSelection();
            if (nextSelection) {
                nextSelection.removeAllRanges();
                nextSelection.addRange(selectionRange);
            }
        }

        const normalizedUrl = url.trim();

        if (selectedText) {
            document.execCommand('createLink', false, normalizedUrl);
        } else {
            const safeUrl = escapeHtml(normalizedUrl);
            document.execCommand('insertHTML', false, `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${safeUrl}</a>`);
        }

        syncMarkdownFromEditor();
    };

    const handleAiButtonClick = () => {
        if (isGenerating) return;

        if (hasAiActions) {
            setIsAiPopoverOpen((prev) => !prev);
            return;
        }

        onAiGenerate?.();
    };

    if (readOnly) {
        return (
            <div className={`prose prose-sm max-w-none text-gray-600 ${className}`}>
                <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                        a: ({node, ...props}) => (
                            <a {...props} className="text-accent-600 hover:underline" target="_blank" rel="noopener noreferrer" />
                        ),
                        input: ({node, ...props}) => (
                            <input
                                {...props}
                                disabled
                                readOnly
                                className="mr-2"
                                style={{ pointerEvents: 'none' }}
                            />
                        ),
                        h1: ({node, ...props}) => <h1 {...props} className={H1_CLASS} />,
                        h2: ({node, ...props}) => <h2 {...props} className={H2_CLASS} />,
                        h3: ({node, ...props}) => <h3 {...props} className={H3_CLASS} />,
                    }}
                >
                    {value || 'No description.'}
                </ReactMarkdown>
            </div>
        );
    }

    return (
        <div className={`border border-gray-200 rounded-lg overflow-hidden bg-white ${className}`}>
            <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200">
                <div className="text-[11px] font-semibold tracking-wide uppercase text-gray-500">Rich Notes</div>

                {hasAiButton && (
                    <div className="relative" ref={aiPopoverRef}>
                        <button
                            onClick={handleAiButtonClick}
                            disabled={isGenerating}
                            className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-accent-600 hover:bg-accent-50 rounded-md transition-colors disabled:opacity-50"
                            aria-haspopup={hasAiActions ? 'menu' : undefined}
                            aria-expanded={hasAiActions ? isAiPopoverOpen : undefined}
                        >
                            {isGenerating ? <Sparkles className="animate-spin" size={12} /> : <Bot size={12} />}
                            Enhance with AI
                        </button>
                        {hasAiActions && isAiPopoverOpen && (
                            <div className="absolute top-full right-0 mt-2 w-72 bg-white border border-gray-200 rounded-lg shadow-xl z-40">
                                <div className="px-3 py-2 border-b border-gray-100 text-xs font-semibold text-gray-600">
                                    What should AI add?
                                </div>
                                <div className="p-2 space-y-1">
                                    {(aiActions || []).map((action) => (
                                        <button
                                            key={action.id}
                                            onClick={() => {
                                                onAiActionSelect?.(action.id);
                                                setIsAiPopoverOpen(false);
                                            }}
                                            className="w-full text-left px-2.5 py-2 rounded-md hover:bg-accent-50 transition-colors"
                                        >
                                            <div className="text-xs font-semibold text-gray-800">{action.label}</div>
                                            <div className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">{action.description}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {aiStatus && (
                <div className="px-3 py-1.5 bg-accent-50/80 border-b border-accent-100 text-[11px] text-accent-700">
                    {aiStatus}
                </div>
            )}

            <div className="px-2 py-1.5 bg-white border-b border-gray-100 flex items-center gap-1 overflow-x-auto">
                <button type="button" onClick={() => handleHeading(1)} className="p-1.5 rounded hover:bg-gray-100 text-gray-600" aria-label="Heading 1">
                    <Heading1 size={14} />
                </button>
                <button type="button" onClick={() => handleHeading(2)} className="p-1.5 rounded hover:bg-gray-100 text-gray-600" aria-label="Heading 2">
                    <Heading2 size={14} />
                </button>
                <button type="button" onClick={() => handleHeading(3)} className="p-1.5 rounded hover:bg-gray-100 text-gray-600" aria-label="Heading 3">
                    <Heading3 size={14} />
                </button>
                <div className="w-px h-5 bg-gray-200 mx-0.5" />
                <button type="button" onClick={() => runCommand('bold')} className="p-1.5 rounded hover:bg-gray-100 text-gray-600" aria-label="Bold">
                    <Bold size={14} />
                </button>
                <button type="button" onClick={() => runCommand('italic')} className="p-1.5 rounded hover:bg-gray-100 text-gray-600" aria-label="Italic">
                    <Italic size={14} />
                </button>
                <div className="w-px h-5 bg-gray-200 mx-0.5" />
                <button type="button" onClick={() => runCommand('insertUnorderedList')} className="p-1.5 rounded hover:bg-gray-100 text-gray-600" aria-label="Bullet list">
                    <List size={14} />
                </button>
                <button type="button" onClick={handleChecklist} className="p-1.5 rounded hover:bg-gray-100 text-gray-600" aria-label="Checklist">
                    <CheckSquare size={14} />
                </button>
                <button type="button" onClick={handleLink} className="p-1.5 rounded hover:bg-gray-100 text-gray-600" aria-label="Link">
                    <Link2 size={14} />
                </button>
            </div>

            <div
                ref={editorRef}
                contentEditable={isEditorInteractive}
                suppressContentEditableWarning
                onInput={syncMarkdownFromEditor}
                onBlur={syncMarkdownFromEditor}
                onClick={(event) => {
                    const target = event.target as HTMLElement;

                    if (target instanceof HTMLAnchorElement) {
                        event.preventDefault();
                    }

                    if (target instanceof HTMLInputElement && target.type === 'checkbox') {
                        syncMarkdownFromEditor();
                    }
                }}
                className="h-48 p-3 overflow-y-auto text-sm text-gray-800 leading-relaxed outline-none [&_h1]:mt-4 [&_h1]:mb-2 [&_h1]:pt-2 [&_h1]:text-base [&_h1]:font-black [&_h1]:tracking-tight [&_h1]:text-gray-800 [&_h1]:border-t [&_h1]:border-gray-100 [&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:pt-2 [&_h2]:text-sm [&_h2]:font-extrabold [&_h2]:tracking-wide [&_h2]:text-gray-800 [&_h2]:border-t [&_h2]:border-gray-100 [&_h3]:mt-4 [&_h3]:mb-2 [&_h3]:pt-2 [&_h3]:text-xs [&_h3]:font-extrabold [&_h3]:uppercase [&_h3]:tracking-wide [&_h3]:text-gray-700 [&_h3]:border-t [&_h3]:border-gray-100 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-1 [&_a]:text-accent-600 [&_a]:underline [&_input[type='checkbox']]:mr-2"
            />

            <div className="px-3 py-1.5 bg-gray-50 border-t border-gray-200 text-[10px] text-gray-400 flex justify-between">
                <span>Rich editor (saved as Markdown)</span>
                <span>{value.length} chars</span>
            </div>
        </div>
    );
};
