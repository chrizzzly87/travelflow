import * as React from 'react';
import { MagnifyingGlass, X } from '@phosphor-icons/react';

import { cn } from '@/lib/utils';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from './input-group';

/**
 * A search field with its magnifying glass, and an optional clear button.
 *
 * Built on `InputGroup`, which lays the icon out with **flex**. Do not
 * re-create this with an absolutely positioned icon over a padded input: that
 * pattern has broken twice here, in both directions.
 *
 *   1. The icon was placed with `inset-inline-start-3`, which is not a Tailwind
 *      utility, so it resolved to `0` and sat on the placeholder. The input's
 *      `ps-9` was separately lost to the base `px-3`, because tailwind-merge
 *      does not treat `px` as conflicting with `ps`.
 *   2. Once both were fixed, adding a gutter (`px-5`) to the same element that
 *      carried `relative` moved the positioning context out from under the
 *      input, and the icon landed *outside* the field.
 *
 * Flex has no positioning context to get wrong. The icon is a sibling of the
 * input, so a gutter on any ancestor moves both together.
 */
export interface SearchInputProps extends Omit<React.ComponentProps<'input'>, 'type'> {
    /** Show a clear button once there is a value. Calls `onClear`. */
    onClear?: () => void;
    clearLabel?: string;
    /** Applied to the group, not the inner control. */
    containerClassName?: string;
}

export const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
    ({ className, containerClassName, onClear, clearLabel = 'Clear search', value, ...props }, ref) => {
        const hasValue = value !== undefined && value !== null && String(value).length > 0;

        return (
            <InputGroup className={cn('h-10 border-slate-300 bg-white', containerClassName)}>
                <InputGroupAddon align="inline-start">
                    <MagnifyingGlass className="size-4 text-slate-400" />
                </InputGroupAddon>

                <InputGroupInput
                    ref={ref}
                    // type="search" would add the browser's own clear affordance
                    // on top of ours, and Safari styles it unremovably.
                    type="text"
                    role="searchbox"
                    autoComplete="off"
                    spellCheck={false}
                    value={value}
                    className={cn('h-full', className)}
                    {...props}
                />

                {onClear && hasValue && (
                    <InputGroupAddon align="inline-end">
                        <InputGroupButton
                            size="icon-xs"
                            aria-label={clearLabel}
                            onClick={onClear}
                            className="text-slate-500 hover:text-slate-900"
                        >
                            <X weight="bold" className="size-3.5" />
                        </InputGroupButton>
                    </InputGroupAddon>
                )}
            </InputGroup>
        );
    },
);
SearchInput.displayName = 'SearchInput';
