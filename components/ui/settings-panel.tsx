import * as React from 'react';

import { cn } from '@/lib/utils';
import { Label } from './label';

/**
 * The layout for a page that is a list of settings.
 *
 * Two surfaces are available. `SettingsGroup` + `SettingsCard` gives each
 * group its own card, stacked in one column; `SettingsPanel` +
 * `SettingsSection` puts every group on one surface separated by dividers.
 * Both stack vertically on purpose — a *grid* of cards stretches every card to
 * the tallest sibling, so a group holding one switch inherits the whitespace
 * of the group holding a model picker, which is what `docs/DESIGN.md` warns
 * against.
 *
 * `SettingsRow` is shared by both and does the real work: it pins every
 * caption to one column and every control to one edge, whatever the group
 * contains.
 */

/** Vertical stack of `SettingsCard`s. */
export const SettingsGroup = React.forwardRef<HTMLDivElement, React.ComponentProps<'div'>>(
    ({ className, ...props }, ref) => (
        <div
            ref={ref}
            data-slot="settings-group"
            className={cn('flex flex-col gap-4', className)}
            {...props}
        />
    ),
);
SettingsGroup.displayName = 'SettingsGroup';

/** One surface for every group, separated by dividers. */
export const SettingsPanel = React.forwardRef<HTMLDivElement, React.ComponentProps<'div'>>(
    ({ className, ...props }, ref) => (
        <div
            ref={ref}
            data-slot="settings-panel"
            className={cn(
                'divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white',
                className,
            )}
            {...props}
        />
    ),
);
SettingsPanel.displayName = 'SettingsPanel';

interface SettingsHeadingProps {
    title: React.ReactNode;
    description?: React.ReactNode;
    icon?: React.ReactNode;
    aside?: React.ReactNode;
}

const SettingsHeading: React.FC<SettingsHeadingProps> = ({ title, description, icon, aside }) => (
    <div className="flex items-start gap-3">
        {icon && (
            <span
                aria-hidden="true"
                className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600 [&_svg]:size-4"
            >
                {icon}
            </span>
        )}
        <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
        </div>
        {aside && <div className="shrink-0">{aside}</div>}
    </div>
);

export interface SettingsSectionProps extends Omit<React.ComponentProps<'section'>, 'title'>, SettingsHeadingProps {
    /** One decision-relevant sentence. Leave it out when the title says it all. */
    description?: React.ReactNode;
    /** A 16px icon. Rendered in a muted tile beside the title. */
    icon?: React.ReactNode;
    /** Status or a count, at the inline end of the heading. */
    aside?: React.ReactNode;
}

/** A titled group of rows inside a `SettingsPanel`. */
export const SettingsSection = React.forwardRef<HTMLElement, SettingsSectionProps>(
    ({ className, title, description, icon, aside, children, ...props }, ref) => (
        <section
            ref={ref}
            data-slot="settings-section"
            className={cn('px-4 py-5 sm:px-6', className)}
            {...props}
        >
            <SettingsHeading title={title} description={description} icon={icon} aside={aside} />
            <div className="mt-3 divide-y divide-slate-100">{children}</div>
        </section>
    ),
);
SettingsSection.displayName = 'SettingsSection';

export type SettingsCardProps = SettingsSectionProps;

/**
 * A titled group of rows on its own card, for a `SettingsGroup` stack.
 *
 * Carries the shadcn card treatment on a real `<section>` rather than nesting
 * `<Card>`: `Card` is a plain function component, and under `preact/compat` a
 * plain function component never receives `ref` — the ref would be dropped
 * silently. Same tokens, semantic element, working ref.
 */
export const SettingsCard = React.forwardRef<HTMLElement, SettingsCardProps>(
    ({ className, title, description, icon, aside, children, ...props }, ref) => (
        <section
            ref={ref}
            data-slot="settings-card"
            className={cn(
                'rounded-lg border border-slate-200 bg-card px-4 py-5 text-card-foreground shadow-sm sm:px-6',
                className,
            )}
            {...props}
        >
            <SettingsHeading title={title} description={description} icon={icon} aside={aside} />
            <div className="mt-3 divide-y divide-slate-100">{children}</div>
        </section>
    ),
);
SettingsCard.displayName = 'SettingsCard';

export interface SettingsRowProps extends Omit<React.ComponentProps<'div'>, 'children'> {
    label: React.ReactNode;
    /** Keep it to one line. Anything longer belongs in the group description. */
    description?: React.ReactNode;
    /**
     * The id of a real form element. Given one, the caption renders as a
     * `<label>`. Omit it for Radix triggers — see the note in `label.tsx`.
     */
    htmlFor?: string;
    /**
     * `inline` puts the control at the inline end, on the caption's baseline —
     * right for switches, selects and short inputs.
     * `stacked` puts it on its own full-width line below, for controls that
     * need the room: pickers, lists, editors.
     */
    layout?: 'inline' | 'stacked';
    /**
     * The consequence of the *current* value, as opposed to the static
     * `description`. Sits in the text column beneath the description on an
     * inline row, and beneath the control on a stacked one — never spanning
     * both columns, which reads as a stray line disconnected from either.
     */
    note?: React.ReactNode;
    children: React.ReactNode;
}

/** One setting: caption and helper on one side, its control on the other. */
export const SettingsRow = React.forwardRef<HTMLDivElement, SettingsRowProps>(
    ({ className, label, description, htmlFor, layout = 'inline', note, children, ...props }, ref) => {
        const noteText = note ? (
            <span className="mt-0.5 block text-sm text-slate-500">{note}</span>
        ) : null;

        const caption = (
            <div className="min-w-0">
                {htmlFor ? (
                    <Label htmlFor={htmlFor}>{label}</Label>
                ) : (
                    <span className="block text-sm font-medium text-slate-900">{label}</span>
                )}
                {description && <span className="mt-0.5 block text-sm text-slate-500">{description}</span>}
                {layout === 'inline' && noteText}
            </div>
        );

        return (
            <div
                ref={ref}
                data-slot="settings-row"
                data-layout={layout}
                className={cn(
                    'py-3.5 first:pt-0 last:pb-0',
                    // A fixed control track rather than `auto`: an auto track
                    // sizes to its own content, so two selects in one group came
                    // out at different widths and a width utility on the trigger
                    // never took effect.
                    layout === 'inline' &&
                        'flex flex-col gap-2 sm:grid sm:grid-cols-[minmax(0,1fr)_18rem] sm:items-center sm:gap-x-6',
                    className,
                )}
                {...props}
            >
                {caption}
                <div
                    className={cn(
                        layout === 'inline'
                            ? 'flex w-full min-w-0 items-center justify-start sm:justify-end'
                            : 'mt-2',
                    )}
                >
                    {children}
                </div>
                {layout === 'stacked' && noteText}

            </div>
        );
    },
);
SettingsRow.displayName = 'SettingsRow';
