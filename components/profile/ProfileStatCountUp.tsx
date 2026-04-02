import React from 'react';

import { AnimatedNumber } from '../ui/animated-number';

interface ProfileStatCountUpProps {
  value: string | number;
  locale?: string;
}

export const ProfileStatCountUp: React.FC<ProfileStatCountUpProps> = ({
  value,
  locale = 'en',
}) => {
  const numericValue = typeof value === 'number' && Number.isFinite(value)
    ? Math.round(value)
    : null;
  const hasSeededAnimationRef = React.useRef(false);
  const [displayValue, setDisplayValue] = React.useState<number>(() => (
    numericValue === null ? 0 : Math.max(0, Math.round(numericValue * 0.78))
  ));

  React.useEffect(() => {
    if (numericValue === null) {
      hasSeededAnimationRef.current = false;
      setDisplayValue(0);
      return;
    }

    if (!hasSeededAnimationRef.current) {
      setDisplayValue(Math.max(0, Math.round(numericValue * 0.78)));
    }

    const frameId = window.requestAnimationFrame(() => {
      hasSeededAnimationRef.current = true;
      setDisplayValue(numericValue);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [numericValue]);

  if (numericValue === null) {
    return <span>{value}</span>;
  }

  return (
    <AnimatedNumber
      value={displayValue}
      locales={locale}
      format={{ maximumFractionDigits: 0 }}
    />
  );
};
