let initialRouteHandoffCompleted = false;

export const hasCompletedInitialRouteHandoff = (): boolean => initialRouteHandoffCompleted;

export const markInitialRouteHandoffCompleted = (): void => {
  initialRouteHandoffCompleted = true;
};

export const resetInitialRouteHandoffCompletedForTests = (): void => {
  initialRouteHandoffCompleted = false;
};
