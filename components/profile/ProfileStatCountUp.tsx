import React from 'react';

interface ProfileStatCountUpProps {
  value: string | number;
  locale?: string;
}

const EASE_OUT_CUBIC = (value: number): number => 1 - ((1 - value) ** 3);

export const ProfileStatCountUp: React.FC<ProfileStatCountUpProps> = ({
  value,
  locale = 'en',
}) => {
  const numericValue = typeof value === 'number' && Number.isFinite(value)
    ? Math.round(value)
    : null;
  const initialTarget = numericValue ?? 0;
  const initialAnimatedValue = Math.max(0, Math.round(initialTarget * 0.78));
  const [displayValue, setDisplayValue] = React.useState<number>(initialAnimatedValue);
  const [isAnimating, setIsAnimating] = React.useState(false);
  const previousValueRef = React.useRef<number>(initialAnimatedValue);
  const rafRef = React.useRef<number | null>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches);
    updatePreference();
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', updatePreference);
      return () => mediaQuery.removeEventListener('change', updatePreference);
    }
    mediaQuery.addListener(updatePreference);
    return () => mediaQuery.removeListener(updatePreference);
  }, []);

  React.useEffect(() => {
    if (numericValue === null) {
      setDisplayValue(0);
      setIsAnimating(false);
      return;
    }

    if (prefersReducedMotion) {
      previousValueRef.current = numericValue;
      setDisplayValue(numericValue);
      setIsAnimating(false);
      return;
    }

    const start = previousValueRef.current;
    const delta = numericValue - start;
    if (delta === 0) {
      setDisplayValue(numericValue);
      setIsAnimating(false);
      return;
    }

    if (rafRef.current !== null && typeof window !== 'undefined') {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    const durationMs = 420;
    const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
    setIsAnimating(true);

    const update = (timestamp: number) => {
      const elapsed = timestamp - startTime;
      const progress = Math.min(1, elapsed / durationMs);
      const eased = EASE_OUT_CUBIC(progress);
      const nextValue = start + (delta * eased);
      setDisplayValue(nextValue);

      if (progress < 1) {
        rafRef.current = window.requestAnimationFrame(update);
        return;
      }

      previousValueRef.current = numericValue;
      setDisplayValue(numericValue);
      setIsAnimating(false);
      rafRef.current = null;
    };

    rafRef.current = window.requestAnimationFrame(update);

    return () => {
      if (rafRef.current !== null && typeof window !== 'undefined') {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [numericValue, prefersReducedMotion]);

  if (numericValue === null) {
    return <span>{value}</span>;
  }

  return (
    <span
      className={[
        'tabular-nums [font-variant-numeric:tabular-nums]',
        isAnimating ? 'blur-[0.5px]' : 'blur-0',
      ].join(' ')}
    >
      {Math.round(displayValue).toLocaleString(locale)}
    </span>
  );
};
