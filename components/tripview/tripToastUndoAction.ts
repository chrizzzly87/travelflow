interface TripToastAction {
  label: string;
  onClick: () => void;
}

interface ResolveTripToastActionParams {
  action?: TripToastAction;
  disableDefaultUndo?: boolean;
  iconVariant?: 'undo' | 'redo';
  onUndo: () => boolean;
  onUndoUnavailable?: () => void;
}

export const resolveTripToastUndoAction = ({
  action,
  disableDefaultUndo,
  iconVariant,
  onUndo,
  onUndoUnavailable,
}: ResolveTripToastActionParams): TripToastAction | undefined => {
  if (action) return action;
  if (disableDefaultUndo) return undefined;
  if (iconVariant === 'undo' || iconVariant === 'redo') return undefined;

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
