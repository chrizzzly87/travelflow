import React from 'react';

/**
 * A row of mutually exclusive choices.
 *
 * This replaces the sliders the customize sheet used for tilt and route
 * thickness. A slider was the wrong control twice over: its 16px white thumb
 * sat invisibly at the far left on a white panel whenever the value was at its
 * minimum, and nobody wants to choose 37 degrees of tilt. Named steps are also
 * what Apple Maps and Google Maps use for the same jobs.
 *
 * Rendered as real radios rather than buttons so arrow keys move between the
 * options and a screen reader announces the group and the selection.
 */

export interface MapSegmentedOption<T extends string | number> {
  value: T;
  label: string;
  /** A colour chip shown above the label, for the style swatches. */
  swatch?: { background: string; border?: string };
}

export interface MapSegmentedControlProps<T extends string | number> {
  name: string;
  label: string;
  value: T;
  options: Array<MapSegmentedOption<T>>;
  onChange: (value: T) => void;
  disabled?: boolean;
  /** Wrap onto several rows instead of sharing one. */
  wrap?: boolean;
  className?: string;
}

export const MapSegmentedControl = <T extends string | number>({
  name,
  label,
  value,
  options,
  onChange,
  disabled = false,
  wrap = false,
  className = '',
}: MapSegmentedControlProps<T>) => (
  <div
    role="radiogroup"
    aria-label={label}
    aria-disabled={disabled || undefined}
    className={[
      'w-full',
      wrap ? 'grid grid-cols-3 gap-1.5' : 'inline-flex w-full rounded-md border border-border bg-secondary p-0.5',
      disabled ? 'opacity-50' : '',
      className,
    ].filter(Boolean).join(' ')}
  >
    {options.map((option) => {
      const isSelected = option.value === value;
      return (
        <label
          key={String(option.value)}
          className={[
            'relative flex min-h-9 cursor-pointer select-none items-center justify-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors',
            wrap ? 'flex-col justify-center py-2' : 'flex-1',
            disabled ? 'cursor-not-allowed' : '',
            isSelected
              ? 'bg-card text-accent-700 shadow-sm ring-1 ring-accent-300 dark:text-accent-200'
              : 'text-muted-foreground hover:text-foreground',
            wrap && !isSelected ? 'border border-border bg-card' : '',
          ].filter(Boolean).join(' ')}
        >
          {/*
            * The radio is visually hidden rather than `display:none`: a hidden
            * input is skipped by keyboard navigation, which would take the
            * arrow-key behaviour a radiogroup exists for.
            */}
          <input
            type="radio"
            name={name}
            value={String(option.value)}
            checked={isSelected}
            disabled={disabled}
            onChange={() => onChange(option.value)}
            className="absolute size-0 opacity-0"
          />
          {option.swatch && (
            <span
              aria-hidden="true"
              className="h-6 w-full rounded border"
              style={{
                background: option.swatch.background,
                borderColor: option.swatch.border ?? 'rgba(15,23,42,0.12)',
              }}
            />
          )}
          <span className={wrap ? 'text-[11px] leading-tight' : ''}>{option.label}</span>
        </label>
      );
    })}
  </div>
);
