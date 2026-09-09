import * as React from 'react';

import { cn } from '@/lib/utils';
import { Label } from './label';

/**
 * One surface for a page of settings.
 *
 * `docs/DESIGN.md` asks for a single panel with dividers and section headings
 * rather than a grid of cards: a card grid stretches every card to the tallest
 * sibling, so a section holding one switch inherits the whitespace of the
 * section holding a model picker. These three parts — panel, section, row —
 * keep every caption on the same column and every control on the same edge,
 * whatever the section contains.
 *
 * ```tsx
 * <SettingsPanel>
 *   <SettingsSection title="Rollout" description="Who can reach a feature." icon={<Flag />}>
 *     <SettingsRow label="Trip Agent" description="The planning chat inside a trip.">
 *       <Switch checked={on} onCheckedChange={setOn} aria-label="Trip Agent" />
 *     </SettingsRow>
 *   </SettingsSection>
 * </SettingsPanel>
 * ```
 */
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

export interface SettingsSectionProps extends Omit<React.ComponentProps<'section'>, 'title'> {
    title: React.ReactNode;
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

            <div className="mt-3 divide-y divide-slate-100">{children}</div>
        </section>
    ),
);
SettingsSection.displayName = 'SettingsSection';

export interface SettingsRowProps extends Omit<React.ComponentProps<'div'>, 'children'> {
    label: React.ReactNode;
    /** Keep it to one line. Anything longer belongs in the section description. */
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
    /** Rendered under the control. Use it for the consequence of the current value. */
    note?: React.ReactNode;
    children: React.ReactNode;
}

/** One setting: caption and helper on one side, its control on the other. */
export const SettingsRow = React.forwardRef<HTMLDivElement, SettingsRowProps>(
    ({ className, label, description, htmlFor, layout = 'inline', note, children, ...props }, ref) => {
        const caption = (
            <div className="min-w-0">
                {htmlFor ? (
                    <Label htmlFor={htmlFor}>{label}</Label>
                ) : (
                    <span className="block text-sm font-medium text-slate-900">{label}</span>
                )}
                {description && <span className="mt-0.5 block text-sm text-slate-500">{description}</span>}
            </div>
        );

        return (
            <div
                ref={ref}
                data-slot="settings-row"
                data-layout={layout}
                className={cn(
                    'py-3.5 first:pt-0 last:pb-0',
                    layout === 'inline' &&
                        'flex flex-col gap-2 sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-x-6',
                    className,
                )}
                {...props}
            >
                {caption}
                <div
                    className={cn(
                        layout === 'inline'
                            ? 'flex shrink-0 items-center justify-start sm:justify-end'
                            : 'mt-2',
                    )}
                >
                    {children}
                </div>
                {note && (
                    <p
                        className={cn(
                            'mt-1.5 text-xs text-slate-500',
                            layout === 'inline' && 'sm:col-span-2 sm:mt-0',
                        )}
                    >
                        {note}
                    </p>
                )}
            </div>
        );
    },
);
SettingsRow.displayName = 'SettingsRow';
