export const toOptionalFiniteNumber = (value: unknown): number | undefined => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export const toFiniteNumber = (value: unknown, fallback: number): number => (
  toOptionalFiniteNumber(value) ?? fallback
);

export const toPositiveFiniteNumber = (
  value: unknown,
  fallback: number,
  minimum = 0,
): number => {
  const parsed = toOptionalFiniteNumber(value);
  if (parsed === undefined || parsed <= 0) return fallback;
  return Math.max(minimum, parsed);
};

export const roundFiniteNumber = (
  value: unknown,
  precision: number,
  fallback: number,
): number => Number(toFiniteNumber(value, fallback).toFixed(precision));
