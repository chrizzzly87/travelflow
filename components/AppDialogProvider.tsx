import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type DialogTone = 'default' | 'danger';

export interface ConfirmDialogOptions {
    title?: string;
    message: React.ReactNode;
    confirmLabel?: string;
    cancelLabel?: string;
    tone?: DialogTone;
}

export interface PromptDialogOptions {
    title?: string;
    message?: React.ReactNode;
    label?: string;
    placeholder?: string;
    defaultValue?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    tone?: DialogTone;
    inputType?: 'text' | 'url' | 'email' | 'search';
    validate?: (value: string) => string | null;
}

interface AppDialogApi {
    confirm: (options: ConfirmDialogOptions) => Promise<boolean>;
    prompt: (options: PromptDialogOptions) => Promise<string | null>;
}

type ConfirmRequest = {
    kind: 'confirm';
    options: ConfirmDialogOptions;
    resolve: (value: boolean) => void;
};

type PromptRequest = {
    kind: 'prompt';
    options: PromptDialogOptions;
    resolve: (value: string | null) => void;
};

type DialogRequest = ConfirmRequest | PromptRequest;

const AppDialogContext = createContext<AppDialogApi | undefined>(undefined);

const focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

const getToneButtonClass = (tone?: DialogTone): string => {
    if (tone === 'danger') return 'bg-red-600 hover:bg-red-700 focus:ring-red-400';
    return 'bg-accent-600 hover:bg-accent-700 focus:ring-accent-400';
};

const hasRenderableContent = (value: React.ReactNode): boolean => {
    if (value === null || value === undefined || typeof value === 'boolean') return false;
    if (typeof value === 'string') return value.trim().length > 0;
    if (Array.isArray(value)) return value.some((entry) => hasRenderableContent(entry));
    return true;
};

export const AppDialogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const queueRef = useRef<DialogRequest[]>([]);
    const [activeRequest, setActiveRequest] = useState<DialogRequest | null>(null);
    const dialogRef = useRef<HTMLDivElement>(null);
    const cancelButtonRef = useRef<HTMLButtonElement>(null);
    const confirmButtonRef = useRef<HTMLButtonElement>(null);
    const promptInputRef = useRef<HTMLInputElement>(null);
    const lastFocusedRef = useRef<HTMLElement | null>(null);
    const [promptValue, setPromptValue] = useState('');
    const [promptError, setPromptError] = useState<string | null>(null);

    const showNext = useCallback(() => {
        if (queueRef.current.length === 0) return;
        const next = queueRef.current.shift() || null;
        setActiveRequest(next);
    }, []);

    useEffect(() => {
        if (!activeRequest) {
            showNext();
        }
    }, [activeRequest, showNext]);

    const enqueue = useCallback((request: DialogRequest) => {
        setActiveRequest((current) => {
            if (!current) return request;
            queueRef.current.push(request);
            return current;
        });
    }, []);

    const confirm = useCallback((options: ConfirmDialogOptions) => {
        return new Promise<boolean>((resolve) => {
            enqueue({ kind: 'confirm', options, resolve });
        });
    }, [enqueue]);

    const prompt = useCallback((options: PromptDialogOptions) => {
        return new Promise<string | null>((resolve) => {
            enqueue({ kind: 'prompt', options, resolve });
        });
    }, [enqueue]);

    const closeWithResult = useCallback((result: boolean | string | null) => {
        if (!activeRequest) return;

        if (activeRequest.kind === 'confirm') {
            activeRequest.resolve(Boolean(result));
        } else {
            activeRequest.resolve(typeof result === 'string' ? result : null);
        }

        setActiveRequest(null);
        setPromptError(null);
    }, [activeRequest]);

    useEffect(() => {
        if (!activeRequest) return;

        if (activeRequest.kind === 'prompt') {
            setPromptValue(activeRequest.options.defaultValue || '');
            setPromptError(null);
        }

        lastFocusedRef.current = document.activeElement as HTMLElement | null;
        const focusTarget = window.setTimeout(() => {
            if (activeRequest.kind === 'prompt') {
                promptInputRef.current?.focus();
                promptInputRef.current?.select();
                return;
            }
            confirmButtonRef.current?.focus();
        }, 0);

        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        return () => {
            window.clearTimeout(focusTarget);
            document.body.style.overflow = originalOverflow;
            if (lastFocusedRef.current) {
                lastFocusedRef.current.focus();
            }
        };
    }, [activeRequest]);

    useEffect(() => {
        if (!activeRequest) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                closeWithResult(activeRequest.kind === 'confirm' ? false : null);
                return;
            }

            if (event.key !== 'Tab' || !dialogRef.current) return;
            const focusables = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(focusableSelector))
                .filter((node) => !node.hasAttribute('disabled'));
            if (focusables.length === 0) return;

            const first = focusables[0];
            const last = focusables[focusables.length - 1];
            const current = document.activeElement as HTMLElement | null;

            if (event.shiftKey) {
                if (current === first || !dialogRef.current.contains(current)) {
                    event.preventDefault();
                    last.focus();
                }
                return;
            }

            if (current === last) {
                event.preventDefault();
                first.focus();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [activeRequest, closeWithResult]);

    const handleConfirmClick = useCallback(() => {
        if (!activeRequest) return;
        if (activeRequest.kind === 'confirm') {
            closeWithResult(true);
            return;
        }

        const nextValue = promptValue.trim();
        const error = activeRequest.options.validate?.(nextValue) || null;
        if (error) {
            setPromptError(error);
            return;
        }
        closeWithResult(nextValue);
    }, [activeRequest, closeWithResult, promptValue]);

    const contextValue = useMemo<AppDialogApi>(() => ({ confirm, prompt }), [confirm, prompt]);
    const descriptionContent = activeRequest
        ? (activeRequest.kind === 'confirm' ? activeRequest.options.message : (activeRequest.options.message || ''))
        : '';
    const hasDescriptionContent = hasRenderableContent(descriptionContent);
    const descriptionNode = hasDescriptionContent
        ? (
            typeof descriptionContent === 'string'
                ? <div className="whitespace-pre-wrap">{descriptionContent}</div>
                : descriptionContent
        )
        : null;

    return (
        <AppDialogContext.Provider value={contextValue}>
            {children}
            {activeRequest && createPortal(
                <div className="fixed inset-0 z-[20000] flex items-end justify-center p-3 sm:items-center sm:p-4">
                    <div
                        className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
                        role="button"
                        tabIndex={0}
                        aria-label="Close dialog"
                        onClick={() => closeWithResult(activeRequest.kind === 'confirm' ? false : null)}
                        onKeyDown={(event) => {
                            if (event.key !== 'Enter' && event.key !== ' ') return;
                            event.preventDefault();
                            closeWithResult(activeRequest.kind === 'confirm' ? false : null);
                        }}
                    />
                    <div
                        ref={dialogRef}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="app-dialog-title"
                        aria-describedby={hasDescriptionContent ? 'app-dialog-description' : undefined}
                        className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-2xl"
                    >
                        <div className="px-5 py-4 border-b border-gray-100">
                            <h2 id="app-dialog-title" className="text-base font-bold text-gray-900">
                                {activeRequest.options.title || (activeRequest.kind === 'confirm' ? 'Confirm Action' : 'Input Required')}
                            </h2>
                        </div>
                        <div className="px-5 py-4 space-y-3">
                            {descriptionNode && (
                                <div
                                    id="app-dialog-description"
                                    className="space-y-3 text-sm leading-relaxed text-gray-600 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5 [&_strong]:font-semibold [&_em]:italic"
                                >
                                    {descriptionNode}
                                </div>
                            )}
                            {activeRequest.kind === 'prompt' && (
                                <div className="space-y-1.5">
                                    {activeRequest.options.label && (
                                        <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                            {activeRequest.options.label}
                                        </label>
                                    )}
                                    <input
                                        ref={promptInputRef}
                                        type={activeRequest.options.inputType || 'text'}
                                        value={promptValue}
                                        onChange={(event) => {
                                            setPromptValue(event.target.value);
                                            if (promptError) setPromptError(null);
                                        }}
                                        className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-800 focus:ring-2 focus:ring-accent-300 focus:border-accent-500 outline-none"
                                        placeholder={activeRequest.options.placeholder}
                                        onKeyDown={(event) => {
                                            if (event.key === 'Enter') {
                                                event.preventDefault();
                                                handleConfirmClick();
                                            }
                                        }}
                                    />
                                    {promptError && (
                                        <p className="text-xs text-red-600">{promptError}</p>
                                    )}
                                </div>
                            )}
                        </div>
                        <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-2">
                            <button
                                ref={cancelButtonRef}
                                type="button"
                                onClick={() => closeWithResult(activeRequest.kind === 'confirm' ? false : null)}
                                className="px-3 py-1.5 text-xs font-semibold text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-300"
                            >
                                {activeRequest.options.cancelLabel || 'Cancel'}
                            </button>
                            <button
                                ref={confirmButtonRef}
                                type="button"
                                onClick={handleConfirmClick}
                                className={`px-3 py-1.5 text-xs font-semibold text-white rounded-md focus:outline-none focus:ring-2 ${getToneButtonClass(activeRequest.options.tone)}`}
                            >
                                {activeRequest.options.confirmLabel || 'Confirm'}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </AppDialogContext.Provider>
    );
};

export const useAppDialog = (): AppDialogApi => {
    const context = useContext(AppDialogContext);
    if (!context) {
        throw new Error('useAppDialog must be used within an AppDialogProvider');
    }
    return context;
};
