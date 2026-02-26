import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { CaretDown, Check, GlobeHemisphereWest, X } from '@phosphor-icons/react';
import { FlagIcon } from '../flags/FlagIcon';
import {
    getProfileCountryOptionByCode,
    searchProfileCountryOptions,
    type ProfileCountryOption,
} from '../../services/profileCountryService';

interface ProfileCountryRegionSelectProps {
    value: string;
    disabled?: boolean;
    placeholder?: string;
    clearLabel?: string;
    emptyLabel?: string;
    toggleLabel?: string;
    onValueChange: (nextValue: string) => void;
}

const clampIndex = (index: number, max: number): number => {
    if (max <= 0) return -1;
    if (index < 0) return 0;
    if (index >= max) return max - 1;
    return index;
};

export const ProfileCountryRegionSelect: React.FC<ProfileCountryRegionSelectProps> = ({
    value,
    disabled = false,
    placeholder = 'Search country or region',
    clearLabel = 'Clear selection',
    emptyLabel = 'No matches',
    toggleLabel = 'Toggle country options',
    onValueChange,
}) => {
    const inputId = useId();
    const listboxId = useId();
    const wrapperRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [activeIndex, setActiveIndex] = useState(0);

    const selectedCountry = useMemo(
        () => getProfileCountryOptionByCode(value),
        [value]
    );

    const options = useMemo(
        () => searchProfileCountryOptions(search, 24),
        [search]
    );

    useEffect(() => {
        setActiveIndex((current) => clampIndex(current, options.length));
    }, [options.length]);

    useEffect(() => {
        if (!isOpen) return;

        const handleOutside = (event: MouseEvent) => {
            if (wrapperRef.current?.contains(event.target as Node)) return;
            setIsOpen(false);
            setSearch('');
        };

        document.addEventListener('mousedown', handleOutside);
        return () => document.removeEventListener('mousedown', handleOutside);
    }, [isOpen]);

    const selectCountry = (country: ProfileCountryOption) => {
        onValueChange(country.code);
        setSearch('');
        setIsOpen(false);
    };

    const handleInputFocus = () => {
        if (disabled) return;
        setIsOpen(true);
        setSearch('');
        const selectedIndex = options.findIndex((option) => option.code === selectedCountry?.code);
        setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    };

    const handleKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (event) => {
        if (disabled) return;

        if (!isOpen && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
            setIsOpen(true);
            return;
        }

        if (!isOpen) return;

        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setActiveIndex((current) => clampIndex(current + 1, options.length));
            return;
        }

        if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActiveIndex((current) => clampIndex(current - 1, options.length));
            return;
        }

        if (event.key === 'Enter') {
            event.preventDefault();
            const active = options[activeIndex];
            if (active) selectCountry(active);
            return;
        }

        if (event.key === 'Escape') {
            event.preventDefault();
            setSearch('');
            setIsOpen(false);
            inputRef.current?.blur();
        }
    };

    const displayValue = isOpen
        ? search
        : (selectedCountry?.name || '');

    return (
        <div className="space-y-1" ref={wrapperRef}>
            <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 start-3 flex items-center">
                    {selectedCountry ? (
                        <FlagIcon code={selectedCountry.code} size="sm" fallback={null} />
                    ) : (
                        <GlobeHemisphereWest size={15} weight="duotone" className="text-slate-400" />
                    )}
                </div>
                <input
                    id={inputId}
                    ref={inputRef}
                    value={displayValue}
                    disabled={disabled}
                    placeholder={placeholder}
                    autoComplete="off"
                    className="h-10 w-full rounded-lg border border-slate-300 bg-white px-9 pe-20 text-sm text-slate-900 outline-none transition-colors focus:border-accent-400 focus:ring-2 focus:ring-accent-200 disabled:cursor-not-allowed disabled:opacity-60"
                    role="combobox"
                    aria-expanded={isOpen}
                    aria-controls={listboxId}
                    aria-autocomplete="list"
                    onFocus={handleInputFocus}
                    onChange={(event) => {
                        setSearch(event.target.value);
                        setIsOpen(true);
                        setActiveIndex(0);
                    }}
                    onKeyDown={handleKeyDown}
                />
                <div className="absolute inset-y-0 end-2 flex items-center gap-1">
                    {selectedCountry && !disabled && (
                        <button
                            type="button"
                            onClick={() => {
                                onValueChange('');
                                setSearch('');
                                setIsOpen(false);
                            }}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                            aria-label={clearLabel}
                        >
                            <X size={14} weight="bold" />
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => {
                            if (disabled) return;
                            setIsOpen((current) => !current);
                            if (!isOpen) {
                                setSearch('');
                                inputRef.current?.focus();
                            }
                        }}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                        aria-label={toggleLabel}
                        tabIndex={-1}
                    >
                        <CaretDown size={14} weight="bold" />
                    </button>
                </div>

                {isOpen && (
                    <div
                        id={listboxId}
                        role="listbox"
                        className="absolute inset-x-0 z-20 mt-1 max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
                    >
                        {options.length === 0 ? (
                            <p className="px-3 py-2 text-xs text-slate-500">{emptyLabel}</p>
                        ) : (
                            options.map((country, index) => (
                                <button
                                    key={country.code}
                                    type="button"
                                    role="option"
                                    aria-selected={country.code === value}
                                    onClick={() => selectCountry(country)}
                                    className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors ${
                                        index === activeIndex ? 'bg-accent-50 text-accent-900' : 'text-slate-700 hover:bg-slate-50'
                                    }`}
                                >
                                    <span className="inline-flex items-center gap-2">
                                        <FlagIcon code={country.code} size="sm" fallback={null} />
                                        <span>{country.name}</span>
                                    </span>
                                    {country.code === value && (
                                        <Check size={14} weight="bold" className="text-accent-700" />
                                    )}
                                </button>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
