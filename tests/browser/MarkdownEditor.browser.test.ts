// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';

import { MarkdownEditor } from '../../components/MarkdownEditor';

vi.mock('../../components/AppDialogProvider', () => ({
  useAppDialog: () => ({
    prompt: vi.fn(),
  }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe('components/MarkdownEditor', () => {
  it('styles headings, keeps checklist rows aligned, and renders Heads Up items as banners without checkboxes', () => {
    const onChange = vi.fn();
    const value = [
      '### Must Do',
      '- [ ] Explore Intramuros',
      '',
      '### Heads Up',
      '- [ ] Use registered taxis at night.',
    ].join('\n');

    const { container } = render(
      React.createElement(MarkdownEditor, {
        value,
        onChange,
      }),
    );

    const editor = container.querySelector('[contenteditable="true"]') as HTMLDivElement | null;
    expect(editor).not.toBeNull();

    const headings = editor?.querySelectorAll('h3');
    expect(headings).toHaveLength(2);
    expect(headings?.[0]).toHaveClass('font-black');

    const checkboxes = editor?.querySelectorAll('input[type="checkbox"]');
    expect(checkboxes).toHaveLength(1);
    expect(editor?.querySelector('[data-heads-up-banner="true"]')).toHaveTextContent('Use registered taxis at night.');

    fireEvent.click(checkboxes![0]);

    expect(onChange).toHaveBeenLastCalledWith(
      expect.stringContaining('- [x] Explore Intramuros'),
    );
    expect(onChange).toHaveBeenLastCalledWith(
      expect.stringContaining('### Heads Up\n\n- Use registered taxis at night.'),
    );
  });
});
