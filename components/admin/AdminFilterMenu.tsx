import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CaretDown, PlusCircle } from '@phosphor-icons/react';
import { createPortal } from 'react-dom';
import { Checkbox } from '../ui/checkbox';

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
    icon?: React.ReactNode;
    allowMultiple?: boolean;
    className?: string;
}

export const AdminFilterMenu: React.FC<AdminFilterMenuProps> = ({
    label,
    options,
    selectedValues,
    onSelectedValuesChange,
    icon,
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
                className={`inline-flex h-8 w-fit items-center justify-center whitespace-nowrap rounded-md border border-dashed border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus:outline-none focus:ring-1 focus:ring-slate-300 disabled:cursor-not-allowed disabled:opacity-50 ${className || ''}`}
                aria-label={`Filter by ${label.toLowerCase()}`}
                aria-expanded={isOpen}
            >
                {icon || <PlusCircle size={14} className="mr-2 text-slate-500 shrink-0" weight="duotone" />}
                <span>{label}</span>
                
                {(selectedCount > 0 || (selectedCount === 0 && !allowMultiple)) && (
                    <div className="mx-2 flex h-4 items-center">
                        <div className="h-full w-[1px] bg-slate-200" />
                    </div>
                )}
                
                {selectedCount > 0 && selectedCount <= 2 && (
                    <div className="flex gap-1">
                        {selectedLabels.map((selectedLabel) => (
                            <span
                                key={`${label}-${selectedLabel}`}
                                className="inline-flex items-center rounded-sm bg-slate-100 px-1 font-normal text-slate-800"
                            >
                                {selectedLabel}
                            </span>
                        ))}
                    </div>
                )}
                
                {selectedCount > 2 && (
                    <span className="inline-flex items-center rounded-sm bg-slate-100 px-1 font-normal text-slate-800">
                        {selectedCount} selected
                    </span>
                )}
                
                {selectedCount === 0 && !allowMultiple && (
                    <span className="font-normal text-slate-500">All</span>
                )}
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
                                <label
                                    key={`${label}-${option.value}`}
                                    className="relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-2 pr-2 text-sm outline-none hover:bg-slate-100 hover:text-slate-900 group"
                                >
                                    <div className="mr-2 flex h-4 w-4 items-center justify-center shrink-0">
                                        <Checkbox
                                            checked={checked}
                                            onCheckedChange={() => toggleOption(option.value)}
                                            className="h-4 w-4"
                                            tabIndex={-1}
                                        />
                                    </div>
                                    <span className="truncate">{option.label}</span>
                                    {typeof option.count === 'number' && (
                                        <span className="ml-auto text-xs text-slate-500">{option.count}</span>
                                    )}
                                </label>
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
