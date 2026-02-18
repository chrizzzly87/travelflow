import React, { useEffect, useRef, useState } from 'react';

interface AdminCountUpNumberProps {
    value: number;
    durationMs?: number;
    className?: string;
}

const formatter = new Intl.NumberFormat();

export const AdminCountUpNumber: React.FC<AdminCountUpNumberProps> = ({
    value,
    durationMs = 520,
    className,
}) => {
    const [displayValue, setDisplayValue] = useState<number>(value);
    const lastStableValueRef = useRef<number>(value);

    useEffect(() => {
        const from = lastStableValueRef.current;
        const to = value;
        if (from === to) {
            setDisplayValue(to);
            return;
        }

        const start = performance.now();
        let frameId = 0;
        const step = (now: number) => {
            const progress = Math.min((now - start) / durationMs, 1);
            const eased = 1 - ((1 - progress) ** 3);
            const nextValue = Math.round(from + ((to - from) * eased));
            setDisplayValue(nextValue);
            if (progress < 1) {
                frameId = window.requestAnimationFrame(step);
                return;
            }
            lastStableValueRef.current = to;
        };
        frameId = window.requestAnimationFrame(step);
        return () => {
            if (frameId) window.cancelAnimationFrame(frameId);
        };
    }, [durationMs, value]);

    return (
        <span className={className}>
            {formatter.format(displayValue)}
        </span>
    );
};
