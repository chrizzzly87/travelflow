import React, { useId } from 'react';
import { Minus, Plus } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';

export type NumberStepperVariant = 'compact' | 'comfortable';

interface NumberStepperProps {
    label: string;
    value: number;
    min: number;
    max: number;
    onChange: (next: number) => void;
    /**
     * `compact` is the classic create-trip card (secondary panel, 32px buttons).
     * `comfortable` is the wizard (card panel, 36px buttons, larger value).
     */
    variant?: NumberStepperVariant;
    className?: string;
}

const clampNumber = (value: number, min: number, max: number): number => Math.max(min, Math.min(value, max));

const VARIANT_CLASSES: Record<NumberStepperVariant, {
    panel: string;
    label: string;
    row: string;
    button: string;
    icon: string;
    value: string;
}> = {
    compact: {
        panel: 'rounded-xl bg-secondary dark:bg-secondary',
        label: 'tracking-[0.12em]',
        row: 'mt-2 gap-2',
        button: 'size-8 rounded-lg bg-card hover:bg-card dark:bg-card dark:hover:bg-card',
        icon: 'size-3.5',
        value: 'text-sm',
    },
    comfortable: {
        panel: 'rounded-2xl bg-card dark:bg-card',
        label: 'tracking-[0.11em]',
        row: 'mt-3 gap-3',
        button: 'size-9 rounded-xl bg-secondary hover:bg-secondary dark:bg-secondary dark:hover:bg-secondary',
        icon: 'size-4',
        value: 'text-lg',
    },
};

export const NumberStepper: React.FC<NumberStepperProps> = ({
    label,
    value,
    min,
    max,
    onChange,
    variant = 'compact',
    className,
}) => {
    const { t } = useTranslation('createTrip');
    const labelId = useId();
    const styles = VARIANT_CLASSES[variant];
    const buttonClassName = cn(
        'border border-border text-muted-foreground transition-colors hover:border-accent-300 hover:text-accent-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-border dark:text-muted-foreground dark:hover:border-accent-400/30 dark:hover:text-accent-200',
        styles.button,
    );

    return (
        <fieldset
            aria-labelledby={labelId}
            data-variant={variant}
            className={cn('m-0 min-w-0 border border-border p-3 dark:border-border', styles.panel, className)}
        >
            <div
                id={labelId}
                className={cn('text-xs font-semibold uppercase text-muted-foreground dark:text-muted-foreground', styles.label)}
            >
                {label}
            </div>
            <div className={cn('flex items-center justify-between', styles.row)}>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => onChange(clampNumber(value - 1, min, max))}
                    disabled={value <= min}
                    aria-label={t('stepper.decrease', { label })}
                    className={buttonClassName}
                >
                    <Minus className={styles.icon} aria-hidden="true" />
                </Button>
                <output
                    aria-live="polite"
                    aria-labelledby={labelId}
                    className={cn('min-w-[2ch] text-center font-semibold text-foreground dark:text-foreground', styles.value)}
                >
                    {value}
                </output>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => onChange(clampNumber(value + 1, min, max))}
                    disabled={value >= max}
                    aria-label={t('stepper.increase', { label })}
                    className={buttonClassName}
                >
                    <Plus className={styles.icon} aria-hidden="true" />
                </Button>
            </div>
        </fieldset>
    );
};
