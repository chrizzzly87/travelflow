// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { NumberInput } from '../../../components/ui/number-input';

describe('components/ui/NumberInput', () => {
  it('shows the animated overlay for controlled numeric values while blurred', () => {
    const { container } = render(
      React.createElement(NumberInput, {
        'aria-label': 'Budget filled',
        value: 12.5,
        onChange: vi.fn(),
        format: { maximumFractionDigits: 1 },
      }),
    );

    const input = screen.getByLabelText('Budget filled');
    expect(input).toHaveClass('text-transparent');
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();

    fireEvent.focus(input);
    expect(input).not.toHaveClass('text-transparent');
    expect(container.querySelector('[aria-hidden="true"]')).toBeNull();

    fireEvent.blur(input);
    expect(input).toHaveClass('text-transparent');
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });

  it('keeps empty controlled values as plain editable input text', () => {
    const { container } = render(
      React.createElement(NumberInput, {
        'aria-label': 'Budget empty',
        value: '',
        onChange: vi.fn(),
      }),
    );

    const input = screen.getByLabelText('Budget empty');
    expect(input).not.toHaveClass('text-transparent');
    expect(container.querySelector('[aria-hidden="true"]')).toBeNull();
  });
});
