import React from 'react';

import { AnimatedNumber } from '../ui/animated-number';

interface AdminCountUpNumberProps {
    value: number;
    durationMs?: number;
    className?: string;
}

export const AdminCountUpNumber: React.FC<AdminCountUpNumberProps> = ({
    value,
    durationMs: _durationMs,
    className,
}) => {
    const [displayValue, setDisplayValue] = React.useState(0);

    React.useEffect(() => {
        const frameId = window.requestAnimationFrame(() => {
            setDisplayValue(value);
        });
        return () => window.cancelAnimationFrame(frameId);
    }, [value]);

    return (
        <AnimatedNumber
            value={displayValue}
            className={className}
            format={{ maximumFractionDigits: 0 }}
        />
    );
};
