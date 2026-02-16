import React from 'react';
import { AppLanguage } from '../../types';
import { LOCALE_DROPDOWN_ORDER, LOCALE_FLAGS, LOCALE_LABELS, normalizeLocale } from '../../config/locales';
import { Select, SelectContent, SelectItem, SelectTrigger } from '../ui/select';
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
    contentAlign = 'end',
}) => {
    return (
        <Select
            value={value}
            onValueChange={(nextValue) => onChange(normalizeLocale(nextValue))}
        >
            <SelectTrigger aria-label={ariaLabel} className={triggerClassName}>
                <span className="inline-flex items-center gap-2 truncate">
                    <FlagIcon code={LOCALE_FLAGS[value]} size="sm" />
                    <span>{LOCALE_LABELS[value]}</span>
                </span>
            </SelectTrigger>
            <SelectContent
                side="bottom"
                align={contentAlign}
                sideOffset={8}
                className="rounded-xl border-slate-200 bg-white p-1 shadow-xl"
            >
                {LOCALE_DROPDOWN_ORDER.map((locale) => (
                    <SelectItem key={locale} value={locale} indicatorPosition="right" className="rounded-lg py-2.5">
                        <span className="inline-flex items-center gap-2 font-medium">
                            <FlagIcon code={LOCALE_FLAGS[locale]} size="sm" />
                            <span>{LOCALE_LABELS[locale]}</span>
                        </span>
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
};
