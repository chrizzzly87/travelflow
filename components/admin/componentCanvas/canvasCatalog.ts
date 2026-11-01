/**
 * What the component canvas shows, as data.
 *
 * Each variant list is checked against the component's own prop type with
 * `exhaustive`, so a variant added to a component without a canvas example is
 * a type error. The coverage test in tests/unit/componentCanvasCatalog.test.ts
 * checks that every file in components/ui is either shown or listed in
 * `CANVAS_OMISSIONS` with a reason.
 */
import type { VariantProps } from 'class-variance-authority';

import type { badgeVariants } from '../../ui/badge';
import type { buttonVariants } from '../../ui/button';
import type { buttonGroupVariants } from '../../ui/button-group';
import type { DialogSize } from '../../ui/dialog';
import type { AppToastTone } from '../../ui/appToast';
import type { SplitFlapEasing } from '../../ui/SplitFlap';
import type { TodayBadgeSize } from '../../ui/today-badge';

/**
 * Accepts a list only when it names every member of `All`; otherwise the
 * argument type demands the missing ones.
 */
export const exhaustive = <All extends string>() =>
    <const Listed extends readonly All[]>(
        list: Listed & ([Exclude<All, Listed[number]>] extends [never] ? unknown : { missing: Exclude<All, Listed[number]> }),
    ): Listed => list;

type ButtonVariant = NonNullable<VariantProps<typeof buttonVariants>['variant']>;
type ButtonSize = NonNullable<VariantProps<typeof buttonVariants>['size']>;
type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>['variant']>;
type ButtonGroupOrientation = NonNullable<VariantProps<typeof buttonGroupVariants>['orientation']>;

export const BUTTON_VARIANTS = exhaustive<ButtonVariant>()([
    'default', 'secondary', 'outline', 'ghost', 'link', 'soft', 'destructive', 'floating', 'toggle', 'social',
]);
/** Text sizes; the icon sizes get their own row so every slot holds the same content. */
export const BUTTON_TEXT_SIZES = ['xs', 'sm', 'default', 'lg'] as const satisfies readonly ButtonSize[];
export const BUTTON_ICON_SIZES = ['icon-xs', 'icon-sm', 'icon', 'icon-lg'] as const satisfies readonly ButtonSize[];
exhaustive<ButtonSize>()([...BUTTON_TEXT_SIZES, ...BUTTON_ICON_SIZES] as const);

export const BADGE_VARIANTS = exhaustive<BadgeVariant>()([
    'default', 'secondary', 'outline', 'ghost', 'link', 'destructive', 'success', 'warning', 'danger', 'info', 'accent', 'neutral',
]);

export const BUTTON_GROUP_ORIENTATIONS = exhaustive<ButtonGroupOrientation>()(['horizontal', 'vertical']);

export const ALERT_VARIANTS = ['default', 'destructive', 'success', 'warning', 'info', 'danger'] as const;

export const DIALOG_SIZES = exhaustive<DialogSize>()(['sm', 'md', 'lg', 'xl']);
export const APP_MODAL_SIZES = ['sm', 'md', 'lg', 'xl'] as const;

export const TOAST_TONES = exhaustive<AppToastTone>()([
    'success', 'error', 'info', 'warning', 'loading', 'add', 'remove', 'update', 'neutral',
]);

export const SPLIT_FLAP_SIZES = ['sm', 'md', 'lg', 'xl'] as const;
export const SPLIT_FLAP_THEMES = ['light', 'dark'] as const;
export const SPLIT_FLAP_SURFACES = ['board', 'bare'] as const;
export const SPLIT_FLAP_EASINGS = exhaustive<SplitFlapEasing>()(['natural', 'linear', 'smooth', 'snap', 'bounce']);

export const TODAY_BADGE_SIZES = exhaustive<TodayBadgeSize>()(['sm', 'md']);

export const POPOVER_SIDES = ['top', 'right', 'bottom', 'left'] as const;

/** components/ui files with no canvas group, and why. */
export const CANVAS_OMISSIONS: Record<string, string> = {
    'ThemeToggle.tsx': 'Every click sends an analytics event (when consent allows) and flips the real site theme. The canvas has its own theme switch instead.',
    'sonner.tsx': 'The app-wide Toaster host. It is already mounted, and the Toasts group drives it.',
};
