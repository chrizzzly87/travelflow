import type {
    ConfirmDialogOptions,
    PromptDialogOptions,
} from '../components/AppDialogProvider';

export type DialogTone = 'default' | 'danger';

type ConfirmPresetInput = Omit<ConfirmDialogOptions, 'tone'>;

type TransferTargetPromptInput = {
    title: string;
    message: PromptDialogOptions['message'];
    confirmLabel: string;
    cancelLabel?: string;
    tone?: DialogTone;
    label?: string;
    placeholder?: string;
    defaultValue?: string;
};

type UrlPromptInput = {
    title?: string;
    message?: PromptDialogOptions['message'];
    label?: string;
    placeholder?: string;
    defaultValue?: string;
    confirmLabel?: string;
    cancelLabel?: string;
};

const DEFAULT_CANCEL_LABEL = 'Cancel';
const DEFAULT_TRANSFER_TARGET_LABEL = 'Target user (email or UUID)';
const DEFAULT_TRANSFER_TARGET_PLACEHOLDER = 'name@example.com or user UUID';

export const buildDangerConfirmDialog = (input: ConfirmPresetInput): ConfirmDialogOptions => ({
    ...input,
    cancelLabel: input.cancelLabel || DEFAULT_CANCEL_LABEL,
    tone: 'danger',
});

export const buildDecisionConfirmDialog = (input: ConfirmPresetInput): ConfirmDialogOptions => ({
    ...input,
    cancelLabel: input.cancelLabel || DEFAULT_CANCEL_LABEL,
    tone: 'default',
});

export const buildTransferTargetPromptDialog = (
    input: TransferTargetPromptInput
): PromptDialogOptions => ({
    title: input.title,
    message: input.message,
    label: input.label || DEFAULT_TRANSFER_TARGET_LABEL,
    placeholder: input.placeholder || DEFAULT_TRANSFER_TARGET_PLACEHOLDER,
    confirmLabel: input.confirmLabel,
    cancelLabel: input.cancelLabel || DEFAULT_CANCEL_LABEL,
    defaultValue: input.defaultValue,
    tone: input.tone || 'danger',
    inputType: 'text',
});

export const buildUrlPromptDialog = (
    input: UrlPromptInput = {}
): PromptDialogOptions => ({
    title: input.title || 'Insert Link',
    message: input.message || 'Enter a URL for the selected text or insert a new link.',
    label: input.label || 'URL',
    placeholder: input.placeholder || 'https://example.com',
    defaultValue: input.defaultValue || 'https://',
    confirmLabel: input.confirmLabel || 'Insert Link',
    cancelLabel: input.cancelLabel || DEFAULT_CANCEL_LABEL,
    inputType: 'url',
    validate: (value) => {
        if (!value) return 'Please enter a URL.';
        try {
            const parsed = new URL(value);
            if (!parsed.protocol.startsWith('http')) {
                return 'URL must start with http:// or https://';
            }
            return null;
        } catch {
            return 'Please enter a valid URL.';
        }
    },
});
