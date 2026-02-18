import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CaretDown, CheckCircle, Circle, PlusCircle } from '@phosphor-icons/react';
import { createPortal } from 'react-dom';

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
    const triggerRef = useRef<HTMLButtonElement | null>(null);
    const menuRef = useRef<HTMLDivElement | null>(null);
    const [menuPosition, setMenuPosition] = useState<{ top: number; left: number; width: number }>({
        top: 0,
        left: 0,
        width: 280,
    });

    const selectedSet = useMemo(() => new Set(selectedValues), [selectedValues]);
    const selectedCount = selectedValues.length;
    const selectedLabels = useMemo(
        () => options
            .filter((option) => selectedSet.has(option.value))
            .map((option) => option.label),
        [options, selectedSet]
    );

    const updateMenuPosition = useCallback(() => {
        const trigger = triggerRef.current;
        if (!trigger) return;
        const rect = trigger.getBoundingClientRect();
        const viewportPadding = 10;
        const preferredWidth = Math.max(280, rect.width + 70);
        const maxLeft = window.innerWidth - preferredWidth - viewportPadding;
        const nextLeft = Math.max(viewportPadding, Math.min(rect.left, maxLeft));
        setMenuPosition({
            top: rect.bottom + 8,
            left: nextLeft,
            width: preferredWidth,
        });
    }, []);

    useEffect(() => {
        if (!isOpen) return undefined;
        updateMenuPosition();
        const onPointer = (event: PointerEvent) => {
            const targetNode = event.target as Node;
            if (triggerRef.current?.contains(targetNode)) return;
            if (menuRef.current?.contains(targetNode)) return;
            setIsOpen(false);
        };
        const onEscape = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            setIsOpen(false);
        };
        const onViewportChange = () => updateMenuPosition();
        window.addEventListener('pointerdown', onPointer);
        window.addEventListener('keydown', onEscape);
        window.addEventListener('resize', onViewportChange);
        window.addEventListener('scroll', onViewportChange, true);
        return () => {
            window.removeEventListener('pointerdown', onPointer);
            window.removeEventListener('keydown', onEscape);
            window.removeEventListener('resize', onViewportChange);
            window.removeEventListener('scroll', onViewportChange, true);
        };
    }, [isOpen, updateMenuPosition]);

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
        <div className={className}>
            <button
                ref={triggerRef}
                type="button"
                onClick={() => {
                    updateMenuPosition();
                    setIsOpen((current) => !current);
                }}
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

            {isOpen && typeof document !== 'undefined' && createPortal(
                <div
                    ref={menuRef}
                    className="fixed z-[1700] rounded-xl border border-slate-200 bg-white shadow-2xl"
                    style={{
                        top: `${menuPosition.top}px`,
                        left: `${menuPosition.left}px`,
                        width: `${menuPosition.width}px`,
                    }}
                >
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
                </div>,
                document.body
            )}
        </div>
    );
};
