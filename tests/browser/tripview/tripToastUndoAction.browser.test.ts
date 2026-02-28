import { describe, expect, it, vi } from 'vitest';
import { resolveTripToastUndoAction } from '../../../components/tripview/tripToastUndoAction';

describe('components/tripview/tripToastUndoAction', () => {
  it('keeps explicit toast action when one is provided', () => {
    const explicitAction = { label: 'Retry', onClick: vi.fn() };

    const resolved = resolveTripToastUndoAction({
      action: explicitAction,
      onUndo: vi.fn(() => true),
    });

    expect(resolved).toBe(explicitAction);
  });

  it('creates a default undo action that calls onUndo', () => {
    const onUndo = vi.fn(() => true);
    const resolved = resolveTripToastUndoAction({
      onUndo,
    });

    expect(resolved?.label).toBe('Undo');
    resolved?.onClick();
    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it('calls onUndoUnavailable when undo cannot run', () => {
    const onUndo = vi.fn(() => false);
    const onUndoUnavailable = vi.fn();
    const resolved = resolveTripToastUndoAction({
      onUndo,
      onUndoUnavailable,
    });

    resolved?.onClick();
    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(onUndoUnavailable).toHaveBeenCalledTimes(1);
  });

  it('allows disabling default undo action', () => {
    const resolved = resolveTripToastUndoAction({
      disableDefaultUndo: true,
      onUndo: vi.fn(() => true),
    });

    expect(resolved).toBeUndefined();
  });
});
