interface TripToastAction {
  label: string;
  onClick: () => void;
}

interface ResolveTripToastActionParams {
  action?: TripToastAction;
  disableDefaultUndo?: boolean;
  onUndo: () => boolean;
  onUndoUnavailable?: () => void;
}

export const resolveTripToastUndoAction = ({
  action,
  disableDefaultUndo,
  onUndo,
  onUndoUnavailable,
}: ResolveTripToastActionParams): TripToastAction | undefined => {
  if (action) return action;
  if (disableDefaultUndo) return undefined;

  return {
    label: 'Undo',
    onClick: () => {
      const didUndo = onUndo();
      if (!didUndo) {
        onUndoUnavailable?.();
      }
    },
  };
};

export type { TripToastAction };
