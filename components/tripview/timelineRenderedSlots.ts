export interface TimelineRenderedDaySlot {
    index: number;
    dayOffset: number;
    start: number;
    size: number;
    date: Date;
    isToday: boolean;
    isWeekend: boolean;
    dayName: string;
    dayNum: number;
    monthName: string;
    monthShort: string;
}

interface BuildRenderedTimelineDaySlotsOptions {
    tripLength: number;
    visualStartOffset: number;
    pixelsPerDay: number;
    fillerSize: number;
    todayIndex: number | null;
    baseStartDate: Date;
}

export const buildRenderedTimelineDaySlots = ({
    tripLength,
    visualStartOffset,
    pixelsPerDay,
    fillerSize,
    todayIndex,
    baseStartDate,
}: BuildRenderedTimelineDaySlotsOptions): TimelineRenderedDaySlot[] => {
    const slots: TimelineRenderedDaySlot[] = [];
    let cursor = 0;

    const pushSlot = (index: number, size: number) => {
        const dayOffset = visualStartOffset + index;
        const date = new Date(baseStartDate);
        date.setDate(baseStartDate.getDate() + dayOffset);
        slots.push({
            index,
            dayOffset,
            start: cursor,
            size,
            date,
            isToday: index === todayIndex,
            isWeekend: date.getDay() === 0 || date.getDay() === 6,
            dayName: date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
            dayNum: date.getDate(),
            monthName: date.toLocaleDateString('en-US', { month: 'long' }),
            monthShort: date.toLocaleDateString('en-US', { month: 'short' }),
        });
        cursor += size;
    };

    for (let index = 0; index < tripLength; index += 1) {
        pushSlot(index, pixelsPerDay);
    }

    let remainingFiller = Math.max(0, fillerSize);
    let extraIndex = tripLength;
    while (remainingFiller > 0.5) {
        const slotSize = Math.min(pixelsPerDay, remainingFiller);
        pushSlot(extraIndex, slotSize);
        remainingFiller -= slotSize;
        extraIndex += 1;
    }

    return slots;
};

export interface TimelineRenderedMonthGroup {
    name: string;
    startIndex: number;
    widthPx: number;
}

export const buildRenderedTimelineMonths = (
    slots: TimelineRenderedDaySlot[],
): TimelineRenderedMonthGroup[] => {
    const months: TimelineRenderedMonthGroup[] = [];

    slots.forEach((slot, index) => {
        const currentMonth = months[months.length - 1];
        if (!currentMonth || currentMonth.name !== slot.monthName) {
            months.push({
                name: slot.monthName,
                startIndex: index,
                widthPx: slot.size,
            });
            return;
        }
        currentMonth.widthPx += slot.size;
    });

    return months;
};
