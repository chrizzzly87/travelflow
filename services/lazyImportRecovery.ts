import { trackEvent } from './analyticsService';

const RECOVERY_FLAG_PREFIX = 'tf_lazy_chunk_recovery:';
const RECOVERABLE_IMPORT_ERROR_PATTERNS: RegExp[] = [
    /failed to fetch dynamically imported module/i,
    /importing a module script failed/i,
    /loading chunk [\w-]+ failed/i,
    /chunkloaderror/i,
    /unexpected token '<'/i,
];

const extractErrorMessage = (error: unknown): string => {
    if (error instanceof Error) return error.message || '';
    if (typeof error === 'string') return error;
    return '';
};

const isRecoverableImportError = (error: unknown): boolean => {
    const message = extractErrorMessage(error);
    if (message && RECOVERABLE_IMPORT_ERROR_PATTERNS.some((pattern) => pattern.test(message))) {
        return true;
    }

    if (typeof error === 'object' && error !== null && 'cause' in error) {
        return isRecoverableImportError((error as { cause?: unknown }).cause);
    }

    return false;
};

const getRecoveryFlagKey = (moduleKey: string): string => `${RECOVERY_FLAG_PREFIX}${moduleKey}`;

const markRecoveryAttempt = (moduleKey: string): boolean => {
    if (typeof window === 'undefined') return false;
    try {
        const key = getRecoveryFlagKey(moduleKey);
        if (window.sessionStorage.getItem(key) === '1') return false;
        window.sessionStorage.setItem(key, '1');
        return true;
    } catch {
        return false;
    }
};

const clearRecoveryAttempt = (moduleKey: string) => {
    if (typeof window === 'undefined') return;
    try {
        window.sessionStorage.removeItem(getRecoveryFlagKey(moduleKey));
    } catch {
        // ignore storage write failures
    }
};

export const loadLazyComponentWithRecovery = async <TModule>(
    moduleKey: string,
    importer: () => Promise<TModule>
): Promise<TModule> => {
    try {
        const loadedModule = await importer();
        clearRecoveryAttempt(moduleKey);
        return loadedModule;
    } catch (error) {
        const canRecover = isRecoverableImportError(error) && markRecoveryAttempt(moduleKey);
        if (!canRecover) {
            throw error;
        }

        trackEvent('app__chunk_recovery--reload', {
            module_key: moduleKey,
            reason: extractErrorMessage(error).slice(0, 160) || 'unknown',
        });

        window.location.reload();

        return new Promise<TModule>(() => {
            // navigation refresh in progress
        });
    }
};
