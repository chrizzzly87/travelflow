let pendingAuthBootstrapPromise: Promise<void> | null = null;
let resolvePendingAuthBootstrapPromise: (() => void) | null = null;

const ensurePendingAuthBootstrapPromise = (): Promise<void> => {
  if (!pendingAuthBootstrapPromise) {
    pendingAuthBootstrapPromise = new Promise<void>((resolve) => {
      resolvePendingAuthBootstrapPromise = resolve;
    });
  }
  return pendingAuthBootstrapPromise;
};

export const suspendUntilAuthBootstrapSettles = (isLoading: boolean): void => {
  if (!isLoading) return;
  throw ensurePendingAuthBootstrapPromise();
};

export const markAuthBootstrapSettled = (): void => {
  if (resolvePendingAuthBootstrapPromise) {
    resolvePendingAuthBootstrapPromise();
  }
  pendingAuthBootstrapPromise = null;
  resolvePendingAuthBootstrapPromise = null;
};

export const resetAuthBootstrapSuspenseForTests = (): void => {
  pendingAuthBootstrapPromise = null;
  resolvePendingAuthBootstrapPromise = null;
};
