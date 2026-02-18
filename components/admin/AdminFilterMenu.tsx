import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CaretDown, CheckCircle, Circle, PlusCircle } from '@phosphor-icons/react';

export interface AdminFilterMenuOption {
    value: string;
    label: string;
    count?: number;
}

interface AdminFilterMenuProps {
    label: string;
    options: AdminFilterMenuOption[];
    selectedValues: string[];
    onSelectedValuesChange: (nextValues: string[]) => void;
    allowMultiple?: boolean;
    className?: string;
}

export const AdminFilterMenu: React.FC<AdminFilterMenuProps> = ({
    label,
    options,
    selectedValues,
    onSelectedValuesChange,
    allowMultiple = true,
    className,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement | null>(null);

    const selectedSet = useMemo(() => new Set(selectedValues), [selectedValues]);
    const selectedCount = selectedValues.length;
    const selectedLabels = useMemo(
        () => options
            .filter((option) => selectedSet.has(option.value))
            .map((option) => option.label),
        [options, selectedSet]
    );

    useEffect(() => {
        if (!isOpen) return undefined;
        const onPointer = (event: PointerEvent) => {
            if (!containerRef.current) return;
            if (containerRef.current.contains(event.target as Node)) return;
            setIsOpen(false);
        };
        const onEscape = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            setIsOpen(false);
        };
        window.addEventListener('pointerdown', onPointer);
        window.addEventListener('keydown', onEscape);
        return () => {
            window.removeEventListener('pointerdown', onPointer);
            window.removeEventListener('keydown', onEscape);
        };
    }, [isOpen]);

    const emitNextValues = (nextSet: Set<string>) => {
        const ordered = options
            .map((option) => option.value)
            .filter((optionValue) => nextSet.has(optionValue));
        onSelectedValuesChange(ordered);
    };

    const toggleOption = (value: string) => {
        const next = new Set(selectedSet);
        const isChecked = next.has(value);
        if (allowMultiple) {
            if (isChecked) {
                next.delete(value);
            } else {
                next.add(value);
            }
            emitNextValues(next);
            return;
        }

        if (isChecked) {
            next.clear();
        } else {
            next.clear();
            next.add(value);
        }
        emitNextValues(next);
        setIsOpen(false);
    };

    return (
        <div className={`relative ${className ?? ''}`.trim()} ref={containerRef}>
            <button
                type="button"
                onClick={() => setIsOpen((current) => !current)}
                className="inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 transition-colors hover:border-slate-400"
                aria-label={`Filter by ${label.toLowerCase()}`}
                aria-expanded={isOpen}
            >
                <PlusCircle size={14} className="text-slate-500" />
                <span>{label}</span>
                <span className="h-4 w-px bg-slate-200" />
                {(selectedCount <= 0 || selectedCount >= options.length) && (
                    <span className="text-slate-600">All</span>
                )}
                {selectedCount > 0 && selectedCount < options.length && selectedCount <= 2 && (
                    <span className="inline-flex items-center gap-1">
                        {selectedLabels.map((selectedLabel) => (
                            <span
                                key={`${label}-${selectedLabel}`}
                                className="rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-700"
                            >
                                {selectedLabel}
                            </span>
                        ))}
                    </span>
                )}
                {selectedCount > 2 && selectedCount < options.length && (
                    <span className="text-slate-600">{selectedCount} selected</span>
                )}
                <CaretDown size={14} className={isOpen ? 'rotate-180 text-slate-500 transition-transform' : 'text-slate-500 transition-transform'} />
            </button>

            {isOpen && (
                <div className="absolute start-0 top-[calc(100%+8px)] z-30 w-[280px] rounded-xl border border-slate-200 bg-white shadow-2xl">
                    <div className="border-b border-slate-100 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                        {label}
                    </div>
                    <div className="max-h-72 overflow-y-auto p-1.5">
                        {options.map((option) => {
                            const checked = selectedSet.has(option.value);
                            return (
                                <button
                                    key={`${label}-${option.value}`}
                                    type="button"
                                    onClick={() => toggleOption(option.value)}
                                    className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                                >
                                    <span className="inline-flex items-center gap-2">
                                        {checked ? (
                                            <CheckCircle size={16} weight="fill" className="text-accent-700" />
                                        ) : (
                                            <Circle size={16} className="text-slate-400" />
                                        )}
                                        {option.label}
                                    </span>
                                    {typeof option.count === 'number' && (
                                        <span className="text-xs font-semibold text-slate-500">{option.count}</span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                    <div className="border-t border-slate-100 p-1.5">
                        <button
                            type="button"
                            onClick={() => {
                                onSelectedValuesChange([]);
                                setIsOpen(false);
                            }}
                            className="w-full rounded-lg px-2.5 py-2 text-left text-sm font-semibold text-slate-600 hover:bg-slate-50"
                        >
                            Clear filters
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
