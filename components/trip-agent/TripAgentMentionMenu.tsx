import React, { useEffect, useRef } from 'react';

export interface TripAgentMentionItem {
    key: string;
    group: string;
    label: string;
    meta?: string;
    isSelected?: boolean;
    icon?: React.ReactNode;
}

/**
 * Mention and preset list for the prompt input.
 *
 * Focus stays in the textarea and the caller drives the highlight from its key
 * handler: cmdk owns focus and wires its keyboard through refs, which
 * preact/compat drops for plain function components, so arrow keys never
 * reached the list.
 */
export const TripAgentMentionMenu: React.FC<{
    items: TripAgentMentionItem[];
    activeIndex: number;
    emptyLabel: string;
    listId: string;
    onSelect: (index: number) => void;
    onHover: (index: number) => void;
}> = ({ items, activeIndex, emptyLabel, listId, onSelect, onHover }) => {
    const activeRef = useRef<HTMLLIElement | null>(null);

    useEffect(() => {
        activeRef.current?.scrollIntoView({ block: 'nearest' });
    }, [activeIndex]);

    if (items.length === 0) {
        return <p className="px-3 py-4 text-center text-xs text-slate-500">{emptyLabel}</p>;
    }

    let lastGroup: string | null = null;

    return (
        <ul id={listId} role="listbox" className="max-h-64 overflow-y-auto py-1">
            {items.map((item, index) => {
                const showGroup = item.group !== lastGroup;
                lastGroup = item.group;
                const isActive = index === activeIndex;
                return (
                    <React.Fragment key={item.key}>
                        {showGroup && (
                            <li
                                aria-hidden="true"
                                className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500"
                            >
                                {item.group}
                            </li>
                        )}
                        <li
                            ref={isActive ? activeRef : undefined}
                            id={`${listId}-option-${index}`}
                            role="option"
                            aria-selected={isActive}
                            onMouseEnter={() => onHover(index)}
                            onMouseDown={(event) => {
                                event.preventDefault();
                                onSelect(index);
                            }}
                            className={`flex cursor-pointer items-center gap-2 px-3 py-1.5 ${
                                isActive ? 'bg-accent-50 text-accent-900' : 'text-slate-700'
                            }`}
                        >
                            {item.icon}
                            <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm">{item.label}</span>
                                {item.meta && <span className="block truncate text-[11px] text-slate-500">{item.meta}</span>}
                            </span>
                            {item.isSelected && <span className="text-[11px] font-medium text-accent-600">✓</span>}
                        </li>
                    </React.Fragment>
                );
            })}
        </ul>
    );
};
