// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { NumberInput } from '../../../components/ui/number-input';

const h = React.createElement;

afterEach(cleanup);

/** Controlled wrapper, the way the settings page uses it. */
const Harness: React.FC<{ start?: number; min?: number; max?: number; onValue?: (n: number) => void }> = ({
  start = 3,
  min = 1,
  max = 36,
  onValue,
}) => {
  const [value, setValue] = React.useState(start);
  return h(NumberInput, {
    'aria-label': 'Age limit',
    min,
    max,
    steppers: true,
    value,
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
      const next = Number(event.target.value);
      setValue(next);
      onValue?.(next);
    },
  });
};

describe('NumberInput steppers', () => {
  it('stays a plain field until steppers are asked for', () => {
    render(h(NumberInput, { 'aria-label': 'Plain', value: 3, onChange: () => {} }));
    expect(screen.queryByRole('button', { name: 'Increase' })).toBeNull();
  });

  it('drives the caller onChange exactly as a typed digit does', async () => {
    const onValue = vi.fn();
    render(h(Harness, { onValue }));
    const field = screen.getByLabelText('Age limit') as HTMLInputElement;

    await userEvent.click(screen.getByRole('button', { name: 'Increase' }));
    expect(onValue).toHaveBeenLastCalledWith(4);

    await userEvent.click(screen.getByRole('button', { name: 'Decrease' }));
    expect(onValue).toHaveBeenLastCalledWith(3);
    expect(field.value).toBe('3');
  });

  it('clamps at the bounds instead of stepping past them', async () => {
    const onValue = vi.fn();
    render(h(Harness, { start: 36, min: 1, max: 36, onValue }));

    const increase = screen.getByRole('button', { name: 'Increase' }) as HTMLButtonElement;
    expect(increase.disabled).toBe(true);

    await userEvent.click(screen.getByRole('button', { name: 'Decrease' }));
    expect(onValue).toHaveBeenLastCalledWith(35);
  });

  it('disables both steppers with the field', () => {
    render(h(NumberInput, { 'aria-label': 'Off', value: 3, steppers: true, disabled: true, onChange: () => {} }));
    expect((screen.getByRole('button', { name: 'Increase' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Decrease' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
