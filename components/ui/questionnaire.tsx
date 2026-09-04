import { Check } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Questionnaire, following shadcn's Base component of the same name (same part
 * names, data-slots and markup), reimplemented on native inputs.
 *
 * The published component depends on `@shadcn/react`, which requires React 19;
 * this app renders through preact/compat on the React 18 types, and that
 * library's ref-as-prop primitives do not survive it.
 */

type ChoiceType = 'single' | 'multiple';

interface QuestionnaireChoicesContextValue {
    type: ChoiceType;
    name: string;
    value: string[];
    disabled?: boolean;
    onToggle: (value: string) => void;
}

const QuestionnaireChoicesContext = React.createContext<QuestionnaireChoicesContextValue | null>(null);

const useQuestionnaireChoices = (): QuestionnaireChoicesContextValue => {
    const context = React.useContext(QuestionnaireChoicesContext);
    if (!context) throw new Error('QuestionnaireChoice must be used within QuestionnaireChoices');
    return context;
};

export const Questionnaire = ({ className, ...props }: React.ComponentProps<'div'>) => (
    <div data-slot="questionnaire" className={cn('flex flex-col gap-3', className)} {...props} />
);

export const QuestionnaireItem = ({ className, ...props }: React.ComponentProps<'fieldset'>) => (
    <fieldset data-slot="questionnaire-item" className={cn('flex min-w-0 flex-col gap-2', className)} {...props} />
);

export const QuestionnaireTitle = ({ className, ...props }: React.ComponentProps<'legend'>) => (
    <legend data-slot="questionnaire-title" className={cn('text-sm font-medium text-slate-900', className)} {...props} />
);

export const QuestionnaireDescription = ({ className, ...props }: React.ComponentProps<'p'>) => (
    <p data-slot="questionnaire-description" className={cn('text-xs text-slate-600', className)} {...props} />
);

export interface QuestionnaireChoicesProps extends Omit<React.ComponentProps<'div'>, 'onChange'> {
    /** `multiple` renders checkboxes, `single` renders radios. */
    type?: ChoiceType;
    value: string[];
    onValueChange: (value: string[]) => void;
    name?: string;
    disabled?: boolean;
}

export const QuestionnaireChoices = ({
    className,
    type = 'multiple',
    value,
    onValueChange,
    name,
    disabled,
    ...props
}: QuestionnaireChoicesProps) => {
    const generatedName = React.useId();
    const contextValue = React.useMemo<QuestionnaireChoicesContextValue>(() => ({
        type,
        name: name || generatedName,
        value,
        disabled,
        onToggle: (choice: string) => {
            if (type === 'single') {
                onValueChange([choice]);
                return;
            }
            onValueChange(value.includes(choice)
                ? value.filter((entry) => entry !== choice)
                : [...value, choice]);
        },
    }), [disabled, generatedName, name, onValueChange, type, value]);

    return (
        <QuestionnaireChoicesContext.Provider value={contextValue}>
            <div
                data-slot="questionnaire-choices"
                data-type={type}
                role={type === 'single' ? 'radiogroup' : 'group'}
                className={cn('grid min-w-0 gap-1', className)}
                {...props}
            />
        </QuestionnaireChoicesContext.Provider>
    );
};

export interface QuestionnaireChoiceProps extends Omit<React.ComponentProps<'label'>, 'value'> {
    value: string;
    disabled?: boolean;
}

export const QuestionnaireChoice = ({
    className,
    children,
    value,
    disabled,
    ...props
}: QuestionnaireChoiceProps) => {
    const choices = useQuestionnaireChoices();
    const isChecked = choices.value.includes(value);
    const isDisabled = disabled || choices.disabled;

    return (
        <label
            data-slot="questionnaire-choice"
            data-type={choices.type === 'single' ? 'radio' : 'checkbox'}
            data-checked={isChecked ? '' : undefined}
            data-disabled={isDisabled ? '' : undefined}
            className={cn(
                'relative flex cursor-pointer items-start gap-2.5 rounded-lg border p-2.5 text-start text-sm transition-colors outline-none select-none',
                isChecked ? 'border-accent-300 bg-accent-50/60' : 'border-slate-200 hover:bg-slate-50',
                isDisabled && 'pointer-events-none cursor-not-allowed opacity-50',
                'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent-500',
                className,
            )}
            {...props}
        >
            <input
                data-slot="questionnaire-choice-input"
                type={choices.type === 'single' ? 'radio' : 'checkbox'}
                name={choices.name}
                value={value}
                checked={isChecked}
                disabled={isDisabled}
                onChange={() => choices.onToggle(value)}
                className="peer sr-only"
            />
            <span
                aria-hidden="true"
                data-slot="questionnaire-choice-indicator"
                className={cn(
                    'pointer-events-none mt-px flex size-4 shrink-0 items-center justify-center border',
                    choices.type === 'single' ? 'rounded-full' : 'rounded-[4px]',
                    isChecked ? 'border-accent-600 bg-accent-600 text-white' : 'border-slate-400 bg-white',
                )}
            >
                {isChecked && (choices.type === 'single'
                    ? <span data-slot="questionnaire-choice-indicator-dot" className="size-1.5 rounded-full bg-white" />
                    : <Check data-slot="questionnaire-choice-indicator-check" className="size-3 stroke-[3]" />)}
            </span>
            <span data-slot="questionnaire-choice-label" className="flex min-w-0 flex-1 flex-col leading-snug">
                {children}
            </span>
        </label>
    );
};

export const QuestionnaireChoiceDescription = ({ className, ...props }: React.ComponentProps<'span'>) => (
    <span
        data-slot="questionnaire-choice-description"
        className={cn('mt-0.5 text-xs text-slate-600', className)}
        {...props}
    />
);

export const QuestionnaireActions = ({ className, ...props }: React.ComponentProps<'div'>) => (
    <div
        data-slot="questionnaire-actions"
        className={cn('flex items-center justify-end gap-2', className)}
        {...props}
    />
);
