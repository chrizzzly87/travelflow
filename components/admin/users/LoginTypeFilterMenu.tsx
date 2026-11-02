import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Key } from '@phosphor-icons/react';
import { Button } from '../../ui/button';
import { Checkbox } from '../../ui/checkbox';
import { cn } from '../../../lib/utils';
import {
    SOCIAL_PROVIDER_OPTIONS,
    SOCIAL_PROVIDER_VALUES,
    USER_LOGIN_TYPE_VALUES,
    type LoginFilterCounts,
    type SocialProviderFilter,
    type UserLoginType,
} from '../adminUsersModel';
import { LOGIN_PILL_STYLES } from './loginPillStyles';

/**
 * Sign-in method filter: email, social (with a per-provider sub-list) and
 * unknown. An empty provider list means "every social provider".
 */
export const LoginTypeFilterMenu: React.FC<{
    selectedLoginTypes: UserLoginType[];
    selectedSocialProviders: SocialProviderFilter[];
    counts: LoginFilterCounts;
    onSelectedLoginTypesChange: (next: UserLoginType[]) => void;
    onSelectedSocialProvidersChange: (next: SocialProviderFilter[]) => void;
}> = ({
    selectedLoginTypes,
    selectedSocialProviders,
    counts,
    onSelectedLoginTypesChange,
    onSelectedSocialProvidersChange,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const triggerRef = useRef<HTMLButtonElement | null>(null);
    const menuRef = useRef<HTMLDivElement | null>(null);
    const [menuPosition, setMenuPosition] = useState<{ top: number; left: number; width: number }>({
        top: 0,
        left: 0,
        width: 320,
    });

    const selectedLoginTypeSet = useMemo(() => new Set(selectedLoginTypes), [selectedLoginTypes]);
    const socialEnabled = selectedLoginTypeSet.has('social');
    const selectedSocialProviderSet = useMemo(
        () => new Set(selectedSocialProviders),
        [selectedSocialProviders]
    );
    const activeSocialProviderCount = socialEnabled
        ? (selectedSocialProviders.length === 0 ? SOCIAL_PROVIDER_VALUES.length : selectedSocialProviders.length)
        : 0;
    const socialIndeterminate = socialEnabled
        && activeSocialProviderCount > 0
        && activeSocialProviderCount < SOCIAL_PROVIDER_VALUES.length;

    const selectedLabelSummary = useMemo(() => {
        if (selectedLoginTypes.length === 0) return null;
        const labels: string[] = [];
        if (selectedLoginTypeSet.has('social')) {
            if (socialIndeterminate) labels.push(`Social (${activeSocialProviderCount})`);
            else labels.push('Social');
        }
        if (selectedLoginTypeSet.has('password')) labels.push('Email');
        if (selectedLoginTypeSet.has('unknown')) labels.push('Unknown');
        return labels.join(', ');
    }, [activeSocialProviderCount, selectedLoginTypeSet, selectedLoginTypes.length, socialIndeterminate]);

    const updateMenuPosition = () => {
        const trigger = triggerRef.current;
        if (!trigger) return;
        const rect = trigger.getBoundingClientRect();
        const viewportPadding = 10;
        const preferredWidth = Math.max(300, rect.width + 70);
        const maxLeft = window.innerWidth - preferredWidth - viewportPadding;
        const nextLeft = Math.max(viewportPadding, Math.min(rect.left, maxLeft));
        setMenuPosition({
            top: rect.bottom + 8,
            left: nextLeft,
            width: preferredWidth,
        });
    };

    // Subscribes to window pointer/keyboard/scroll events while the popover is open.
    useEffect(() => {
        if (!isOpen) return undefined;
        updateMenuPosition();
        const onPointer = (event: PointerEvent) => {
            const targetNode = event.target as Node;
            if (triggerRef.current?.contains(targetNode)) return;
            if (menuRef.current?.contains(targetNode)) return;
            setIsOpen(false);
        };
        const onEscape = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            setIsOpen(false);
            triggerRef.current?.focus();
        };
        const onViewportChange = () => updateMenuPosition();
        window.addEventListener('pointerdown', onPointer);
        window.addEventListener('keydown', onEscape);
        window.addEventListener('resize', onViewportChange);
        window.addEventListener('scroll', onViewportChange, true);
        return () => {
            window.removeEventListener('pointerdown', onPointer);
            window.removeEventListener('keydown', onEscape);
            window.removeEventListener('resize', onViewportChange);
            window.removeEventListener('scroll', onViewportChange, true);
        };
    }, [isOpen]);

    const setLoginTypeChecked = (value: UserLoginType, checked: boolean) => {
        const next = new Set(selectedLoginTypeSet);
        if (checked) next.add(value);
        else next.delete(value);
        if (!next.has('social')) onSelectedSocialProvidersChange([]);
        onSelectedLoginTypesChange(USER_LOGIN_TYPE_VALUES.filter((candidate) => next.has(candidate)));
    };

    const setSocialParentChecked = (checked: boolean) => {
        const next = new Set(selectedLoginTypeSet);
        if (checked) {
            next.add('social');
        } else {
            next.delete('social');
            onSelectedSocialProvidersChange([]);
        }
        onSelectedLoginTypesChange(USER_LOGIN_TYPE_VALUES.filter((candidate) => next.has(candidate)));
    };

    const toggleSocialProvider = (provider: SocialProviderFilter) => {
        const next = new Set(
            selectedSocialProviders.length === 0
                ? SOCIAL_PROVIDER_VALUES
                : selectedSocialProviders
        );
        if (next.has(provider)) next.delete(provider);
        else next.add(provider);
        if (next.size === 0) {
            setLoginTypeChecked('social', false);
            onSelectedSocialProvidersChange([]);
            return;
        }
        setLoginTypeChecked('social', true);
        const ordered = SOCIAL_PROVIDER_VALUES.filter((candidate) => next.has(candidate));
        if (ordered.length === SOCIAL_PROVIDER_VALUES.length) {
            onSelectedSocialProvidersChange([]);
            return;
        }
        onSelectedSocialProvidersChange(ordered);
    };

    const socialCheckboxState: boolean | 'indeterminate' = socialEnabled
        ? (socialIndeterminate ? 'indeterminate' : true)
        : false;

    const optionRowClass = 'relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-secondary hover:text-foreground';

    return (
        <div>
            <Button
                ref={triggerRef}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                    updateMenuPosition();
                    setIsOpen((current) => !current);
                }}
                className="h-8 w-fit gap-0 border-dashed px-3 text-xs"
                aria-label="Filter by sign-in method"
                aria-haspopup="true"
                aria-expanded={isOpen}
            >
                <Key size={14} className="me-2 shrink-0 text-muted-foreground" weight="duotone" />
                <span>Sign-in method</span>
                {selectedLabelSummary && (
                    <>
                        <span className="mx-2 h-4 w-px bg-border" aria-hidden="true" />
                        <span className="inline-flex max-w-[220px] items-center truncate rounded-sm bg-secondary px-1 font-normal text-secondary-foreground">
                            {selectedLabelSummary}
                        </span>
                    </>
                )}
            </Button>

            {isOpen && typeof document !== 'undefined' && createPortal(
                <div
                    ref={menuRef}
                    role="group"
                    aria-label="Sign-in method filters"
                    className="fixed z-[1700] overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] dark:shadow-none"
                    style={{
                        top: `${menuPosition.top}px`,
                        left: `${menuPosition.left}px`,
                        width: `${menuPosition.width}px`,
                    }}
                >
                    <div className="space-y-0.5 p-1">
                        <label className={optionRowClass}>
                            <div className="me-2 flex size-4 shrink-0 items-center justify-center">
                                <Checkbox
                                    checked={selectedLoginTypeSet.has('password')}
                                    onCheckedChange={(checked) => setLoginTypeChecked('password', Boolean(checked))}
                                    className="size-4"
                                />
                            </div>
                            <span>Email and password</span>
                            <span className="ms-auto text-xs tabular-nums text-muted-foreground">{counts.password}</span>
                        </label>
                        <label className={optionRowClass}>
                            <div className="me-2 flex size-4 shrink-0 items-center justify-center">
                                <Checkbox
                                    checked={socialCheckboxState}
                                    onCheckedChange={(checked) => setSocialParentChecked(Boolean(checked))}
                                    className="size-4"
                                />
                            </div>
                            <span>Social</span>
                            <span className="ms-auto text-xs tabular-nums text-muted-foreground">{counts.social}</span>
                        </label>
                        <div className={cn('ms-6 space-y-0.5 border-s-2 border-border ps-2', !socialEnabled && 'pointer-events-none opacity-50')}>
                            {SOCIAL_PROVIDER_OPTIONS.map((option) => {
                                const checked = socialEnabled
                                    && (selectedSocialProviders.length === 0 || selectedSocialProviderSet.has(option.value));
                                const Icon = LOGIN_PILL_STYLES[option.value].icon;
                                return (
                                    <label
                                        key={`social-provider-filter-${option.value}`}
                                        className="relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-xs outline-none hover:bg-secondary hover:text-foreground"
                                    >
                                        <div className="me-2 flex size-3.5 shrink-0 items-center justify-center">
                                            <Checkbox
                                                checked={checked}
                                                onCheckedChange={() => toggleSocialProvider(option.value)}
                                                className="size-3.5 rounded-[2px]"
                                            />
                                        </div>
                                        <Icon size={12} className="me-1.5 text-muted-foreground" />
                                        <span>{option.label}</span>
                                        <span className="ms-auto text-xs tabular-nums text-muted-foreground">{counts.socialProviders[option.value]}</span>
                                    </label>
                                );
                            })}
                        </div>
                        <label className={optionRowClass}>
                            <div className="me-2 flex size-4 shrink-0 items-center justify-center">
                                <Checkbox
                                    checked={selectedLoginTypeSet.has('unknown')}
                                    onCheckedChange={(checked) => setLoginTypeChecked('unknown', Boolean(checked))}
                                    className="size-4"
                                />
                            </div>
                            <span>Unknown</span>
                            <span className="ms-auto text-xs tabular-nums text-muted-foreground">{counts.unknown}</span>
                        </label>
                    </div>
                    {selectedLoginTypeSet.size > 0 && (
                        <>
                            <div className="h-px bg-border" />
                            <div className="p-1">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        onSelectedLoginTypesChange([]);
                                        onSelectedSocialProvidersChange([]);
                                        setIsOpen(false);
                                    }}
                                    className="w-full"
                                >
                                    Clear filter
                                </Button>
                            </div>
                        </>
                    )}
                </div>,
                document.body
            )}
        </div>
    );
};
