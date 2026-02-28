import { describe, expect, it } from 'vitest';
import {
  buildDangerConfirmDialog,
  buildDecisionConfirmDialog,
  buildTransferTargetPromptDialog,
  buildUrlPromptDialog,
} from '../../services/appDialogPresets';

describe('services/appDialogPresets', () => {
  it('builds danger confirm dialogs with default cancel label', () => {
    const options = buildDangerConfirmDialog({
      title: 'Hard delete trip',
      message: 'This cannot be undone.',
      confirmLabel: 'Hard delete',
    });

    expect(options.tone).toBe('danger');
    expect(options.cancelLabel).toBe('Cancel');
  });

  it('builds decision confirm dialogs with default tone and cancel label', () => {
    const options = buildDecisionConfirmDialog({
      title: 'Apply to all cities?',
      message: 'Keep current colors or recolor all.',
      confirmLabel: 'Apply',
    });

    expect(options.tone).toBe('default');
    expect(options.cancelLabel).toBe('Cancel');
  });

  it('builds transfer target prompts with shared defaults', () => {
    const options = buildTransferTargetPromptDialog({
      title: 'Transfer trip owner',
      message: 'Enter a target owner.',
      confirmLabel: 'Continue',
    });

    expect(options.inputType).toBe('text');
    expect(options.tone).toBe('danger');
    expect(options.label).toBe('Target user (email or UUID)');
    expect(options.placeholder).toBe('name@example.com or user UUID');
    expect(options.cancelLabel).toBe('Cancel');
  });

  it('builds URL prompts with validation', () => {
    const options = buildUrlPromptDialog();

    expect(options.inputType).toBe('url');
    expect(options.defaultValue).toBe('https://');
    expect(options.validate?.('https://example.com')).toBeNull();
    expect(options.validate?.('ftp://example.com')).toBe('URL must start with http:// or https://');
    expect(options.validate?.('not-a-url')).toBe('Please enter a valid URL.');
  });
});

