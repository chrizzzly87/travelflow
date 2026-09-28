import React from 'react';
import { useTranslation } from 'react-i18next';
import type { TripLaneDayTripMark } from '../../shared/dayTripPreview';
import { getHexFromColorClass } from '../../utils';

const MARK_WIDTH_PX = 12;

/**
 * Day trips on a trip card's stay lane: a small dashed hop that leaves the
 * stay's bar and lands back on it, echoing the dashed day-trip line on the
 * map. Rendered inside the lane hitbox, which must be `position: relative`.
 * Each hop carries its own tooltip, so hovering it names the destination
 * instead of the stay.
 */
export const TripLaneDayTripMarks: React.FC<{
    marks?: TripLaneDayTripMark[];
    color: string;
}> = ({ marks, color }) => {
    const { t } = useTranslation('common');
    if (!marks || marks.length === 0) return null;
    const kindLabel = t('tripView.activityPlan.kindDayTrip');
    // Lanes may carry a stored colour class rather than a hex value. The mix
    // toward the text colour keeps the hop legible on light and dark cards.
    const strokeColor = `color-mix(in srgb, ${getHexFromColorClass(color)} 50%, var(--foreground, #0f172a))`;

    return (
        <>
            {marks.map((mark) => {
                const label = mark.label ? `${kindLabel} · ${mark.label}` : kindLabel;
                return (
                    <span
                        key={mark.id}
                        role="img"
                        aria-label={label}
                        data-tooltip={label}
                        className="trip-lane-day-trip absolute bottom-1/2 z-[1] block"
                        style={{
                            insetInlineStart: `${Math.round(mark.position * 1000) / 10}%`,
                            marginInlineStart: -MARK_WIDTH_PX / 2,
                            width: MARK_WIDTH_PX,
                            color: strokeColor,
                        }}
                    >
                        <svg viewBox="0 0 12 8" width={MARK_WIDTH_PX} height={8} aria-hidden="true" className="block overflow-visible">
                            <path
                                d="M1.5 8 C1.5 1.5, 10.5 1.5, 10.5 8"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={1.4}
                                strokeLinecap="round"
                                strokeDasharray="2 1.6"
                            />
                            <circle cx="6" cy="3" r="1.9" fill="currentColor" stroke="var(--card, #fff)" strokeWidth={0.9} />
                        </svg>
                    </span>
                );
            })}
        </>
    );
};
