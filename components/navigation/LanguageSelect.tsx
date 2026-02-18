import React from 'react';
import { AppLanguage } from '../../types';
import { LOCALE_DROPDOWN_ORDER, LOCALE_FLAGS, LOCALE_LABELS, normalizeLocale } from '../../config/locales';
import { CaretDown } from '@phosphor-icons/react';
import { FlagIcon } from '../flags/FlagIcon';

interface LanguageSelectProps {
    value: AppLanguage;
    onChange: (nextLocale: AppLanguage) => void;
    ariaLabel: string;
    triggerClassName?: string;
    contentAlign?: 'start' | 'center' | 'end';
}

export const LanguageSelect: React.FC<LanguageSelectProps> = ({
    value,
    onChange,
    ariaLabel,
    triggerClassName,
    contentAlign = 'end', // kept for backwards compatibility; native select ignores menu alignment.
}) => {
    void contentAlign;

    const triggerClasses = [
        'relative inline-flex w-full items-center rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900',
        'outline-none ring-offset-white focus-within:ring-2 focus-within:ring-accent-500 focus-within:ring-offset-0',
        triggerClassName || '',
    ].join(' ').trim();

    return (
        <label className={triggerClasses}>
            <span className="pointer-events-none inline-flex min-w-0 items-center gap-2 pr-6">
                <FlagIcon code={LOCALE_FLAGS[value]} size="sm" />
                <span className="truncate">{LOCALE_LABELS[value]}</span>
            </span>
            <select
                aria-label={ariaLabel}
                className="absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent text-transparent"
                value={value}
                onChange={(event) => onChange(normalizeLocale(event.target.value))}
            >
                {LOCALE_DROPDOWN_ORDER.map((locale) => (
                    <option key={locale} value={locale}>
                        {LOCALE_LABELS[locale]}
                    </option>
                ))}
            </select>
            <span className="pointer-events-none absolute inset-y-0 right-2 inline-flex items-center text-slate-500">
                <CaretDown size={14} />
            </span>
        </label>
    );
};
