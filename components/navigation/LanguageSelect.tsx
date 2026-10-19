import React, { useEffect } from 'react';
import { activateBootControls } from '../../services/bootInteractionBridge';
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
    portalContainer?: HTMLElement | null;
}

export const LanguageSelect: React.FC<LanguageSelectProps> = ({
    value,
    onChange,
    ariaLabel,
    triggerClassName,
    contentAlign = 'end',
    portalContainer,
}) => {
    useEffect(() => activateBootControls('language-select'), []);
    return (
        <Select
            value={value}
            onValueChange={(nextValue) => onChange(normalizeLocale(nextValue))}
        >
            <SelectTrigger aria-label={ariaLabel} className={triggerClassName}
                data-tf-boot-replay={`language:${ariaLabel}`}
                data-tf-boot-scope="language-select" data-tf-boot-event="pointerdown">
                <span className="inline-flex items-center gap-2 truncate">
                    <FlagIcon code={LOCALE_FLAGS[value]} size="sm" />
                    <span>{LOCALE_LABELS[value]}</span>
                </span>
            </SelectTrigger>
            <SelectContent
                portalContainer={portalContainer}
                side="bottom"
                align={contentAlign}
                sideOffset={8}
                className="rounded-xl border-border bg-card p-1 shadow-xl dark:border-border dark:bg-card dark:shadow-none"
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
