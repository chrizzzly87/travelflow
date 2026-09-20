import * as React from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { CaretDown, CaretUp, Check } from '@phosphor-icons/react';

const Select = SelectPrimitive.Root;
const SelectGroup = SelectPrimitive.Group;
const SelectValue = SelectPrimitive.Value;

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={[
      'flex h-10 w-full cursor-pointer items-center justify-between gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground dark:border-border dark:bg-card dark:text-foreground',
      'outline-none ring-offset-white placeholder:text-muted-foreground focus-visible:border-accent-400 dark:placeholder:text-muted-foreground',
      'disabled:cursor-not-allowed disabled:opacity-50',
      className || '',
    ].join(' ')}
    {...props}
  >
    {/* The value has to truncate on its own: a long option in a narrow
        trigger otherwise pushes the caret past the trigger's edge. */}
    <span className="min-w-0 flex-1 truncate text-start">{children}</span>
    <SelectPrimitive.Icon asChild>
      <CaretDown weight="bold" className="size-4 shrink-0 text-muted-foreground dark:text-muted-foreground" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

const SelectScrollUpButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollUpButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollUpButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollUpButton
    ref={ref}
    className={[
      'flex cursor-pointer items-center justify-center py-1 text-muted-foreground dark:text-muted-foreground',
      className || '',
    ].join(' ')}
    {...props}
  >
    <CaretUp weight="bold" className="size-4" />
  </SelectPrimitive.ScrollUpButton>
));
SelectScrollUpButton.displayName = SelectPrimitive.ScrollUpButton.displayName;

const SelectScrollDownButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollDownButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollDownButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollDownButton
    ref={ref}
    className={[
      'flex cursor-pointer items-center justify-center py-1 text-muted-foreground dark:text-muted-foreground',
      className || '',
    ].join(' ')}
    {...props}
  >
    <CaretDown weight="bold" className="size-4" />
  </SelectPrimitive.ScrollDownButton>
));
SelectScrollDownButton.displayName = SelectPrimitive.ScrollDownButton.displayName;

const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = 'popper', ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      className={[
        'relative z-[1755] max-h-80 min-w-[10rem] overflow-hidden rounded-md border border-border bg-card text-foreground shadow-lg dark:border-border dark:bg-card dark:text-foreground',
        'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
        position === 'popper'
          ? 'data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1'
          : '',
        className || '',
      ].join(' ')}
      position={position}
      {...props}
    >
      <SelectScrollUpButton />
      <SelectPrimitive.Viewport
        className={[
          'p-1',
          position === 'popper'
            ? 'w-full min-w-[var(--radix-select-trigger-width)]'
            : '',
        ].join(' ')}
      >
        {children}
      </SelectPrimitive.Viewport>
      <SelectScrollDownButton />
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));
SelectContent.displayName = SelectPrimitive.Content.displayName;

const SelectLabel = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label
    ref={ref}
    className={[
      'px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground dark:text-muted-foreground',
      className || '',
    ].join(' ')}
    {...props}
  />
));
SelectLabel.displayName = SelectPrimitive.Label.displayName;

interface SelectItemProps extends React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item> {
  indicatorPosition?: 'left' | 'right';
}

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  SelectItemProps
>(({ className, children, indicatorPosition = 'left', ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={[
      'relative flex w-full cursor-pointer select-none items-center rounded-sm py-2 text-sm text-foreground outline-none dark:text-foreground',
      indicatorPosition === 'right' ? 'pl-2 pr-8' : 'pl-8 pr-2',
      'data-[highlighted]:bg-accent-100 data-[highlighted]:text-accent-900 dark:data-[highlighted]:bg-accent-400/25 dark:data-[highlighted]:text-white data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      className || '',
    ].join(' ')}
    {...props}
  >
    <span
      className={[
        'absolute top-1/2 flex size-3.5 -translate-y-1/2 items-center justify-center',
        indicatorPosition === 'right' ? 'right-2' : 'left-2',
      ].join(' ')}
    >
      <SelectPrimitive.ItemIndicator>
        <Check weight="bold" className="size-4 text-accent-600 dark:text-accent-400" />
      </SelectPrimitive.ItemIndicator>
    </span>

    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
));
SelectItem.displayName = SelectPrimitive.Item.displayName;

const SelectSeparator = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator
    ref={ref}
    className={[
      '-mx-1 my-1 h-px bg-secondary dark:bg-secondary',
      className || '',
    ].join(' ')}
    {...props}
  />
));
SelectSeparator.displayName = SelectPrimitive.Separator.displayName;

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
};
