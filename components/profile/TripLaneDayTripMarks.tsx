import React from 'react';
import { useTranslation } from 'react-i18next';
import type { TripLaneDayTripMark } from '../../shared/dayTripPreview';
import { getHexFromColorClass } from '../../utils';

const DOT_SIZE_PX = 8;

/**
 * Day trips on a trip card's stay lane: a small dot in the stay's own colour,
 * ringed in the card colour so it reads as a stop on the bar without adding
 * a new colour to the strip. Rendered inside the lane hitbox, which must be
 * `position: relative`. Each dot carries its own tooltip, so hovering it
 * names the destination instead of the stay.
 */
export const TripLaneDayTripMarks: React.FC<{
    marks?: TripLaneDayTripMark[];
    color: string;
}> = ({ marks, color }) => {
    const { t } = useTranslation('common');
    if (!marks || marks.length === 0) return null;
    const kindLabel = t('tripView.activityPlan.kindDayTrip');
    // Lanes may carry a stored colour class rather than a hex value.
    const fillColor = getHexFromColorClass(color);

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
                        className="trip-lane-day-trip absolute top-1/2 z-[1] block rounded-full border-[1.5px] border-card"
                        style={{
                            insetInlineStart: `${Math.round(mark.position * 1000) / 10}%`,
                            marginInlineStart: -DOT_SIZE_PX / 2,
                            marginTop: -DOT_SIZE_PX / 2,
                            width: DOT_SIZE_PX,
                            height: DOT_SIZE_PX,
                            backgroundColor: fillColor,
                        }}
                    />
                );
            })}
        </>
    );
};
