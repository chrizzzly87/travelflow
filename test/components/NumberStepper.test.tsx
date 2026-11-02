// @vitest-environment jsdom
import React, { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { NumberStepper } from '../../components/create-trip/NumberStepper';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      if (key === 'stepper.decrease') return `Decrease ${String(options?.label)}`;
      if (key === 'stepper.increase') return `Increase ${String(options?.label)}`;
      return key;
    },
  }),
}));

const ControlledStepper: React.FC<{ initial: number; min: number; max: number; onChange?: (next: number) => void }> = ({
  initial,
  min,
  max,
  onChange,
}) => {
  const [value, setValue] = useState(initial);
  return (
    <NumberStepper
      label="Adults"
      value={value}
      min={min}
      max={max}
      onChange={(next) => {
        onChange?.(next);
        setValue(next);
      }}
    />
  );
};

describe('components/create-trip/NumberStepper', () => {
  it('labels the group, both buttons and the live value', () => {
    render(<NumberStepper label="Adults" value={2} min={1} max={8} onChange={vi.fn()} />);

    expect(screen.getByRole('group', { name: 'Adults' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Decrease Adults' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Increase Adults' })).toBeTruthy();
    const output = screen.getByRole('status', { name: 'Adults' });
    expect(output.textContent).toBe('2');
    expect(output.getAttribute('aria-live')).toBe('polite');
  });

  it('increments and decrements by one', () => {
    render(<ControlledStepper initial={3} min={1} max={8} />);

    fireEvent.click(screen.getByRole('button', { name: 'Increase Adults' }));
    expect(screen.getByRole('status').textContent).toBe('4');

    fireEvent.click(screen.getByRole('button', { name: 'Decrease Adults' }));
    fireEvent.click(screen.getByRole('button', { name: 'Decrease Adults' }));
    expect(screen.getByRole('status').textContent).toBe('2');
  });

  it('disables decrease at min and increase at max', () => {
    const { rerender } = render(<NumberStepper label="Adults" value={1} min={1} max={8} onChange={vi.fn()} />);
    expect((screen.getByRole('button', { name: 'Decrease Adults' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Increase Adults' }) as HTMLButtonElement).disabled).toBe(false);

    rerender(<NumberStepper label="Adults" value={8} min={1} max={8} onChange={vi.fn()} />);
    expect((screen.getByRole('button', { name: 'Decrease Adults' }) as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByRole('button', { name: 'Increase Adults' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('stops at the bounds when stepping repeatedly', () => {
    const onChange = vi.fn();
    render(<ControlledStepper initial={7} min={0} max={8} onChange={onChange} />);
    const increase = screen.getByRole('button', { name: 'Increase Adults' });

    fireEvent.click(increase);
    fireEvent.click(increase);
    fireEvent.click(increase);

    expect(screen.getByRole('status').textContent).toBe('8');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith(8);
  });

  it('clamps an out-of-range value back into the range', () => {
    const onChange = vi.fn();
    render(<NumberStepper label="Adults" value={12} min={1} max={8} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Decrease Adults' }));
    expect(onChange).toHaveBeenCalledWith(8);
  });

  it('renders the requested variant', () => {
    render(<NumberStepper label="Weeks" value={2} min={1} max={8} onChange={vi.fn()} variant="comfortable" />);
    expect(screen.getByRole('group', { name: 'Weeks' }).getAttribute('data-variant')).toBe('comfortable');
  });
});
