import { vi } from 'vitest';

export const setFixedSystemTime = (iso: string): Date => {
  const fixedDate = new Date(iso);
  vi.useFakeTimers();
  vi.setSystemTime(fixedDate);
  return fixedDate;
};
