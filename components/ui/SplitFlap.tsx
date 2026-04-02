import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './SplitFlap.css';

const DEFAULT_CHARSET = ' ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.:-!?/';
const MIN_HALF_DURATION_MS = 75;

const EASING_PRESETS = {
    natural: { fold: 'ease-in', unfold: 'ease-out' },
    linear: { fold: 'linear', unfold: 'linear' },
    smooth: { fold: 'cubic-bezier(0.4, 0, 1, 0.6)', unfold: 'cubic-bezier(0, 0.4, 0.6, 1)' },
    snap: { fold: 'cubic-bezier(0.7, 0, 1, 0.4)', unfold: 'cubic-bezier(0, 0.6, 0.3, 1)' },
    bounce: { fold: 'ease-in', unfold: 'cubic-bezier(0.34, 1.56, 0.64, 1)' },
} as const;

type SplitFlapCharset = string | string[];
type SplitFlapTheme = 'dark' | 'light';
type SplitFlapSize = 'sm' | 'md' | 'lg' | 'xl';
type SplitFlapSurface = 'board' | 'bare';
export type SplitFlapEasing = keyof typeof EASING_PRESETS;

export const SPLIT_FLAP_CHARSET_ALPHA = ' ABCDEFGHIJKLMNOPQRSTUVWXYZ';
export const SPLIT_FLAP_CHARSET_NUMERIC = ' 0123456789';
export const SPLIT_FLAP_CHARSET_TIME = ' 0123456789:';
export const SPLIT_FLAP_CHARSET_ALPHANUMERIC = ' ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
export const SPLIT_FLAP_CHARSET_HOUR_TENS = '012';
export const SPLIT_FLAP_CHARSET_MIN_TENS = '012345';
export const SPLIT_FLAP_CHARSET_DIGITS = '0123456789';

interface SplitFlapProps {
    value?: string;
    length?: number;
    charset?: SplitFlapCharset;
    charsetPerCell?: Array<SplitFlapCharset | undefined>;
    flipDuration?: number;
    drumSpeed?: number;
    maxSteps?: number;
    easing?: SplitFlapEasing;
    stagger?: number;
    startDelay?: number;
    size?: SplitFlapSize;
    theme?: SplitFlapTheme;
    surface?: SplitFlapSurface;
    className?: string;
    padChar?: string;
    onFlipEnd?: () => void;
}

interface FlapCellProps {
    target: string;
    charset: string[];
    flipDuration: number;
    drumSpeed: number;
    maxSteps: number;
    easing: SplitFlapEasing;
    delay: number;
    onDone?: () => void;
}

const toCharacterArray = (value: SplitFlapCharset): string[] => (
    typeof value === 'string' ? [...value] : value
);

const FlapCell: React.FC<FlapCellProps> = ({
    target,
    charset,
    flipDuration,
    drumSpeed,
    maxSteps,
    easing,
    delay,
    onDone,
}) => {
    const [display, setDisplay] = useState({ current: target, previous: target });
    const [phase, setPhase] = useState<'idle' | 'folding' | 'unfolding'>('idle');
    const [isLastFlip, setIsLastFlip] = useState(false);
    const queueRef = useRef<string[]>([]);
    const isAnimatingRef = useRef(false);
    const isMountedRef = useRef(true);
    const currentCharacterRef = useRef(target);

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    const processQueue = useCallback(() => {
        if (isAnimatingRef.current || !isMountedRef.current) return;
        if (queueRef.current.length === 0) {
            onDone?.();
            return;
        }

        isAnimatingRef.current = true;
        const nextCharacter = queueRef.current.shift();
        if (!nextCharacter) {
            isAnimatingRef.current = false;
            onDone?.();
            return;
        }

        const landingFlip = queueRef.current.length === 0;
        const totalDuration = landingFlip ? flipDuration : drumSpeed;
        const halfDuration = Math.max(Math.floor(totalDuration / 2), MIN_HALF_DURATION_MS);

        setIsLastFlip(landingFlip);
        setDisplay({ current: nextCharacter, previous: currentCharacterRef.current });
        currentCharacterRef.current = nextCharacter;
        setPhase('folding');

        window.setTimeout(() => {
            if (!isMountedRef.current) return;
            setPhase('unfolding');

            window.setTimeout(() => {
                if (!isMountedRef.current) return;
                setPhase('idle');
                isAnimatingRef.current = false;
                window.requestAnimationFrame(() => {
                    if (isMountedRef.current) processQueue();
                });
            }, halfDuration);
        }, halfDuration);
    }, [drumSpeed, flipDuration, onDone]);

    useEffect(() => {
        const fromIndex = charset.indexOf(currentCharacterRef.current.toUpperCase());
        const toIndex = charset.indexOf(target.toUpperCase());

        if (fromIndex === toIndex) {
            onDone?.();
            return;
        }

        const queue: string[] = [];
        let cursor = fromIndex < 0 ? 0 : fromIndex;
        let safety = 0;

        while (safety < charset.length + 1) {
            safety += 1;
            cursor = (cursor + 1) % charset.length;
            queue.push(charset[cursor]);
            if (cursor === toIndex) break;
        }

        queueRef.current = maxSteps > 0 && queue.length > maxSteps
            ? queue.slice(queue.length - maxSteps)
            : queue;

        const timerId = window.setTimeout(() => {
            if (isMountedRef.current) processQueue();
        }, delay);

        return () => {
            window.clearTimeout(timerId);
        };
    }, [charset, delay, maxSteps, onDone, processQueue, target]);

    const isFlipping = phase !== 'idle';
    const totalDuration = isLastFlip ? flipDuration : drumSpeed;
    const halfDuration = totalDuration / 2;
    const easingCss = isLastFlip
        ? EASING_PRESETS[easing]
        : { fold: 'linear', unfold: 'linear' };

    return (
        <span
            className={`sf-cell${isFlipping ? ' sf-cell--flip' : ''}`}
            style={{
                '--flip-half': `${halfDuration}ms`,
                '--sf-ease-fold': easingCss.fold,
                '--sf-ease-unfold': easingCss.unfold,
            } as React.CSSProperties}
        >
            <span className="sf-half sf-top" aria-hidden="true">
                <span className="sf-ch">{display.current}</span>
            </span>

            <span className="sf-half sf-bottom" aria-hidden="true">
                <span className="sf-ch">{phase === 'folding' ? display.previous : display.current}</span>
            </span>

            {phase === 'folding' && (
                <>
                    <span className="sf-half sf-top sf-fold-top" aria-hidden="true">
                        <span className="sf-ch">{display.previous}</span>
                    </span>
                    <span className="sf-bottom-shadow" aria-hidden="true" />
                </>
            )}

            {phase === 'unfolding' && (
                <span className="sf-half sf-bottom sf-unfold-btm" aria-hidden="true">
                    <span className="sf-ch">{display.current}</span>
                </span>
            )}

            <span className="sf-sr">{display.current}</span>
        </span>
    );
};

export const SplitFlap: React.FC<SplitFlapProps> = ({
    value = '',
    length,
    charset = DEFAULT_CHARSET,
    charsetPerCell,
    flipDuration = 500,
    drumSpeed = 125,
    maxSteps = 5,
    easing = 'natural',
    stagger = 150,
    startDelay = 0,
    size = 'md',
    theme = 'light',
    surface = 'board',
    className = '',
    padChar = ' ',
    onFlipEnd,
}) => {
    const characterArray = useMemo(() => toCharacterArray(charset), [charset]);
    const displayLength = length ?? value.length;
    const paddedValue = value.toUpperCase().padEnd(displayLength, padChar).slice(0, displayLength);
    const doneCountRef = useRef(0);
    const totalCellCountRef = useRef(displayLength);

    totalCellCountRef.current = displayLength;

    const handleCellDone = useCallback(() => {
        doneCountRef.current += 1;
        if (doneCountRef.current >= totalCellCountRef.current) {
            onFlipEnd?.();
        }
    }, [onFlipEnd]);

    useEffect(() => {
        doneCountRef.current = 0;
    }, [value]);

    return (
        <span
            className={`sf-board sf-board--${size} sf-board--${theme} sf-board--${surface}${className ? ` ${className}` : ''}`}
            role="img"
            aria-label={paddedValue}
        >
            {Array.from({ length: displayLength }, (_, index) => {
                const nextCharset = charsetPerCell?.[index] != null
                    ? toCharacterArray(charsetPerCell[index] as SplitFlapCharset)
                    : characterArray;

                return (
                    <FlapCell
                        key={index}
                        target={paddedValue[index] || padChar}
                        charset={nextCharset}
                        flipDuration={flipDuration}
                        drumSpeed={drumSpeed}
                        maxSteps={maxSteps}
                        easing={easing}
                        delay={startDelay + (stagger * index)}
                        onDone={handleCellDone}
                    />
                );
            })}
        </span>
    );
};

export default SplitFlap;
