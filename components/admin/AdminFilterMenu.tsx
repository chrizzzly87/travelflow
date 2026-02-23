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
                className={`inline-flex h-10 items-center justify-between gap-2 whitespace-nowrap rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm ring-offset-background transition-colors placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1 ${className || ''}`}
                aria-label={`Filter by ${label.toLowerCase()}`}
                aria-expanded={isOpen}
            >
                <div className="flex items-center gap-2">
                    <PlusCircle size={14} className="text-muted-foreground" />
                    <span className="font-medium text-slate-800">{label}</span>
                    {(selectedCount > 0 || (selectedCount === 0 && !allowMultiple)) && (
                        <span className="h-4 w-px bg-border mx-1" />
                    )}
                    {selectedCount === 0 && !allowMultiple && (
                        <span className="text-muted-foreground">All</span>
                    )}
                    {selectedCount > 0 && selectedCount < options.length && selectedCount <= 2 && (
                        <div className="flex -space-x-1">
                            {selectedLabels.map((selectedLabel) => (
                                <span
                                    key={`${label}-${selectedLabel}`}
                                    className="inline-flex items-center rounded-sm border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-800 shadow-sm"
                                >
                                    {selectedLabel}
                                </span>
                            ))}
                        </div>
                    )}
                    {selectedCount > 2 && selectedCount < options.length && (
                        <span className="inline-flex items-center rounded-sm border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-800 shadow-sm">
                            {selectedCount} selected
                        </span>
                    )}
                    {selectedCount >= options.length && options.length > 0 && (
                        <span className="text-muted-foreground">All</span>
                    )}
                </div>
                <CaretDown size={14} className={`text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && typeof document !== 'undefined' && createPortal(
                <div
                    ref={menuRef}
                    className="fixed z-[1700] overflow-hidden rounded-md border border-slate-200 bg-white text-slate-950 shadow-md animate-in fade-in-80"
                    style={{
                        top: `${menuPosition.top}px`,
                        left: `${menuPosition.left}px`,
                        width: `${menuPosition.width}px`,
                    }}
                >
                    <div className="px-2 py-1.5 text-xs font-medium text-slate-500">
                        {label}
                    </div>
                    <div className="h-px bg-slate-100" />
                    <div className="max-h-72 overflow-y-auto p-1">
                        {options.map((option) => {
                            const checked = selectedSet.has(option.value);
                            return (
                                <button
                                    key={`${label}-${option.value}`}
                                    type="button"
                                    onClick={() => toggleOption(option.value)}
                                    className="relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none hover:bg-slate-100 hover:text-slate-900 data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                                >
                                    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                                        {checked && <CheckCircle size={14} weight="bold" className="text-slate-900" />}
                                    </span>
                                    <span className="truncate">{option.label}</span>
                                    {typeof option.count === 'number' && (
                                        <span className="ml-auto text-xs text-slate-500">{option.count}</span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                    {selectedCount > 0 && (
                        <>
                            <div className="h-px bg-slate-100" />
                            <div className="p-1">
                                <button
                                    type="button"
                                    onClick={() => {
                                        onSelectedValuesChange([]);
                                        setIsOpen(false);
                                    }}
                                    className="relative flex w-full cursor-default select-none items-center justify-center rounded-sm py-1.5 text-sm font-medium outline-none hover:bg-slate-100 hover:text-slate-900"
                                >
                                    Clear filters
                                </button>
                            </div>
                        </>
                    )}
                </div>,
                document.body
            )}
        </div>
    );
};
