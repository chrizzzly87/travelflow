import React, { useRef, useState, useEffect } from 'react';
import { ITrip, ITimelineItem, IDragState } from '../types';
import { addDays, findTravelBetweenCities, getTimelineBounds, TRAVEL_COLOR, TRAVEL_EMPTY_COLOR } from '../utils';
import { TimelineBlock } from './TimelineBlock';
import { Plus } from 'lucide-react';
import { TransportModeIcon } from './TransportModeIcon';
import { normalizeTransportMode } from '../shared/transportModes';

interface TimelineProps {
  trip: ITrip;
  selectedCityIds?: string[];
  selectedItemId: string | null;
  onSelect: (id: string | null, options?: { multi?: boolean; isCity?: boolean }) => void;
  onUpdateItems: (items: ITimelineItem[], options?: { deferCommit?: boolean }) => void;
  onAddActivity: (dayOffset: number) => void;
  onForceFill?: (id: string) => void;
  onSwapSelectedCities?: () => void;
  onAddCity: () => void;
  pixelsPerDay: number;
  readOnly?: boolean;
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;

const parseLocalTripDate = (value: string): Date | null => {
  if (!value) return null;

  const plainDate = value.includes('T') ? value.slice(0, 10) : value;
  const parts = plainDate.split('-').map(Number);
  if (parts.length === 3) {
    const [year, month, day] = parts;
    if (!Number.isNaN(year) && !Number.isNaN(month) && !Number.isNaN(day)) {
      return new Date(year, month - 1, day);
    }
  }

  const fallback = new Date(value);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
};

export const Timeline: React.FC<TimelineProps> = ({
  trip,
  selectedCityIds = [],
  selectedItemId,
  onSelect,
  onUpdateItems,
  onAddActivity,
  onForceFill,
  onSwapSelectedCities,
  onAddCity,
  pixelsPerDay,
  readOnly = false
}) => {
  const canEdit = !readOnly;
  const containerRef = useRef<HTMLDivElement>(null);
  const travelLaneRef = useRef<HTMLDivElement>(null);
  const ignoreClickRef = useRef<boolean>(false);
  const dragStartItemsRef = useRef<ITimelineItem[] | null>(null);
  const latestDragItemsRef = useRef<ITimelineItem[] | null>(null);
  const lastAutoScrollSelectionRef = useRef<string | null>(null);
  
  // Use Refs for synchronous drag tracking to avoid state update race conditions
  const isDraggingRef = useRef(false);
  const dragStartPosRef = useRef(0);

  const [dragState, setDragState] = useState<IDragState>({
    isDragging: false,
    itemId: null,
    action: null,
    startX: 0,
    originalOffset: 0,
    originalDuration: 0,
  });

  const [hoverTravelStart, setHoverTravelStart] = useState<number | null>(null);

  const timelineBounds = React.useMemo(() => getTimelineBounds(trip.items), [trip.items]);
  const visualStartOffset = timelineBounds.startOffset;
  const tripLength = timelineBounds.dayCount;
  const totalWidth = tripLength * pixelsPerDay;
  const parsedTripStartDate = React.useMemo(() => parseLocalTripDate(trip.startDate), [trip.startDate]);

  const tripDayRange = React.useMemo(() => {
    let minStart = Number.POSITIVE_INFINITY;
    let maxEnd = Number.NEGATIVE_INFINITY;

    trip.items.forEach((item) => {
      if (!Number.isFinite(item.startDateOffset) || !Number.isFinite(item.duration)) return;
      minStart = Math.min(minStart, item.startDateOffset);
      maxEnd = Math.max(maxEnd, item.startDateOffset + item.duration);
    });

    if (!Number.isFinite(minStart) || !Number.isFinite(maxEnd) || maxEnd <= minStart) {
      return { start: 0, end: 0 };
    }

    return {
      start: Math.floor(minStart),
      end: Math.ceil(maxEnd),
    };
  }, [trip.items]);

  const todayColumnIndex = React.useMemo(() => {
    if (!parsedTripStartDate) return null;

    const startAtNoon = new Date(parsedTripStartDate);
    startAtNoon.setHours(12, 0, 0, 0);

    const todayAtNoon = new Date();
    todayAtNoon.setHours(12, 0, 0, 0);

    const offset = Math.round((todayAtNoon.getTime() - startAtNoon.getTime()) / MS_PER_DAY);
    if (!Number.isFinite(offset)) return null;
    if (offset < visualStartOffset || offset >= (visualStartOffset + tripLength)) return null;
    if (offset < tripDayRange.start || offset >= tripDayRange.end) return null;

    return offset - visualStartOffset;
  }, [parsedTripStartDate, tripLength, tripDayRange.end, tripDayRange.start, visualStartOffset]);
  
  // Separate items into lanes
  const cities = trip.items.filter(i => i.type === 'city').sort((a, b) => a.startDateOffset - b.startDateOffset);
  const travelItems = trip.items.filter(i => i.type === 'travel' || i.type === 'travel-empty').sort((a, b) => a.startDateOffset - b.startDateOffset);
  const activities = trip.items.filter(i => i.type === 'activity');

  const travelLinks = React.useMemo(() => {
      return cities.slice(0, -1).map((city, idx) => {
          const nextCity = cities[idx + 1];
          const travelItem = findTravelBetweenCities(trip.items, city, nextCity);
          return {
              id: travelItem?.id || `travel-link-${city.id}-${nextCity.id}`,
              fromCity: city,
              toCity: nextCity,
              travelItem
          };
      });
  }, [cities, trip.items]);

  const getTransportIcon = (mode?: string) => {
      return <TransportModeIcon mode={mode} size={14} />;
  };

  // Robust "Packing" algorithm for activities to handle same-day overlapping
  const activityLanes: ITimelineItem[][] = [];
  activities.sort((a, b) => {
      // Sort by start time, then by duration (longest first)
      if (a.startDateOffset === b.startDateOffset) return b.duration - a.duration;
      return a.startDateOffset - b.startDateOffset;
  }).forEach(item => {
    let placed = false;
    for (const lane of activityLanes) {
        const lastInLane = lane[lane.length - 1];
        // Ensure visual gap of at least 0.05 days
        if (lastInLane.startDateOffset + lastInLane.duration + 0.05 <= item.startDateOffset) {
            lane.push(item);
            placed = true;
            break;
        }
    }
    if (!placed) activityLanes.push([item]);
  });
  // Ensure minimum lanes
  while (activityLanes.length < 3) activityLanes.push([]);

  // --- Actions ---

  const handleBlockSelect = (id: string | null, options?: { multi?: boolean; isCity?: boolean }) => {
      // Prevent selection if we just finished dragging
      if (ignoreClickRef.current) {
          ignoreClickRef.current = false;
          return;
      }
      onSelect(id, options);
  };

  const handleAddTravel = () => {
    if (!canEdit) return;
    // Legacy button handler - adds to end or gap
    let newStart = 0;
    if (travelItems.length > 0) {
        const lastTravel = travelItems[travelItems.length - 1];
        newStart = lastTravel.startDateOffset + lastTravel.duration + 0.1;
    } else if (cities.length > 1) {
        newStart = cities[0].startDateOffset + cities[0].duration;
    }
    createTravelItem(newStart, 0.2); // Default small duration
  };

  const handleSelectOrCreateTravel = (fromCity: ITimelineItem, toCity: ITimelineItem, existing?: ITimelineItem | null) => {
      if (existing) {
          onSelect(existing.id);
          return;
      }
      if (!canEdit) return;
      const startOffset = fromCity.startDateOffset + fromCity.duration;
      const newItem: ITimelineItem = {
          id: `travel-new-${Date.now()}`,
          type: 'travel-empty',
          title: `Travel to ${toCity.title}`,
          startDateOffset: startOffset,
          duration: 0.2,
          color: TRAVEL_EMPTY_COLOR,
          description: 'Transport not set'
      };
      onUpdateItems([...trip.items, newItem]);
      onSelect(newItem.id);
  };

  const createTravelItem = (startOffset: number, duration: number) => {
    if (!canEdit) return;
    const id = `travel-new-${Date.now()}`;
    const newTravel: ITimelineItem = {
        id,
        type: 'travel',
        title: 'New Travel',
        startDateOffset: startOffset,
        duration: duration,
        color: TRAVEL_COLOR,
        description: 'Travel segment',
        transportMode: 'car'
    };
    onUpdateItems([...trip.items, newTravel]);
    onSelect(id); // Auto-open drawer
  };

  // --- Travel Lane Interaction ---

  const handleTravelMouseMove = (e: React.MouseEvent) => {
      if (!canEdit) {
          if (hoverTravelStart !== null) setHoverTravelStart(null);
          return;
      }
      if (!travelLaneRef.current) return;
      
      // Prevent ghost from showing up if we are hovering over an existing block
      const target = e.target as HTMLElement;
      if (target.closest('.timeline-block-item')) {
          setHoverTravelStart(null);
          return;
      }

      const rect = travelLaneRef.current.getBoundingClientRect();
      const offsetX = e.clientX - rect.left;
      const rawDay = visualStartOffset + (offsetX / pixelsPerDay);
      
      // Calculate start time so that the block (duration=1.0) is centered on mouse
      // Center = Start + 0.5  =>  Start = Center - 0.5
      let start = rawDay - 0.5;
      
      // Snap to 0.5 increments
      const snapStep = 0.5;
      start = Math.round(start / snapStep) * snapStep;
      
      if (start < visualStartOffset) start = visualStartOffset;
      
      setHoverTravelStart(start);
  };

  const handleTravelMouseLeave = () => {
      setHoverTravelStart(null);
  };

  const handleTravelClick = () => {
      if (!canEdit) return;
      if (hoverTravelStart !== null) {
          createTravelItem(hoverTravelStart, 1.0);
          setHoverTravelStart(null);
      }
  };

  // --- Resize/Drag Logic ---

  const handleResizeStart = (e: React.MouseEvent | React.PointerEvent, id: string, direction: 'left' | 'right') => {
    if (!canEdit) return;
    e.stopPropagation();
    const item = trip.items.find(i => i.id === id);
    if (!item) return;

    isDraggingRef.current = false;
    dragStartPosRef.current = e.clientX;

    // Snapshot items at drag start to avoid cumulative drift on fast moves
    dragStartItemsRef.current = trip.items.map(i => ({ ...i }));

    setDragState({
      isDragging: false, 
      itemId: id,
      action: direction === 'left' ? 'resize-left' : 'resize-right',
      startX: e.clientX,
      originalOffset: item.startDateOffset,
      originalDuration: item.duration,
    });
  };

  const handleMoveStart = (e: React.MouseEvent | React.PointerEvent, id: string) => {
    if (!canEdit) return;
    e.stopPropagation();
    const item = trip.items.find(i => i.id === id);
    if (!item) return;

    isDraggingRef.current = false;
    dragStartPosRef.current = e.clientX;

    dragStartItemsRef.current = trip.items.map(i => ({ ...i }));

    setDragState({
      isDragging: false, 
      itemId: id,
      action: 'move',
      startX: e.clientX,
      originalOffset: item.startDateOffset,
      originalDuration: item.duration,
    });
  };

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      // Check if we have an active operation
      if (!dragState.itemId || !dragState.action) return;

      const deltaX = e.clientX - dragStartPosRef.current;
      const deltaDays = deltaX / pixelsPerDay; 

      // Threshold check: If not yet dragging, check if we moved enough
      if (!isDraggingRef.current) {
        if (Math.abs(deltaX) < 5) return; // 5px threshold
        isDraggingRef.current = true;
        // Update state to reflect dragging (visuals)
        setDragState(prev => ({ ...prev, isDragging: true }));
      }

      const baseItems = dragStartItemsRef.current || trip.items;
      const currentItemIndex = baseItems.findIndex(i => i.id === dragState.itemId);
      if (currentItemIndex === -1) return;
      
      const currentItem = baseItems[currentItemIndex];
      const newItems = baseItems.map(i => ({ ...i }));

      const isTravel = currentItem.type === 'travel' || currentItem.type === 'travel-empty';
      const snap = isTravel ? 0.05 : 0.5;
      const roundToStep = (value: number, step: number) => Math.round(value / step) * step;
      const snappedDelta = roundToStep(deltaDays, snap);

      if (Math.abs(snappedDelta) === 0) return;

      if (dragState.action === 'move') {
          let newStart = roundToStep(dragState.originalOffset + snappedDelta, snap);
          if (newStart < 0) newStart = 0;
          
          if (Math.abs(currentItem.startDateOffset - newStart) < 0.000001) return;

          newItems[currentItemIndex] = { ...currentItem, startDateOffset: newStart };
          latestDragItemsRef.current = newItems;
          onUpdateItems(newItems, { deferCommit: true });
      } 
      else if (dragState.action === 'resize-right') {
        const minDuration = isTravel ? 0.05 : 0.5;
        const newDuration = Math.max(minDuration, roundToStep(dragState.originalDuration + snappedDelta, snap));
        const diff = newDuration - dragState.originalDuration;
        if (Math.abs(diff) < 0.000001) return; 

        if (currentItem.type === 'city') {
            const currentEnd = dragState.originalOffset + dragState.originalDuration;
            newItems[currentItemIndex] = { ...currentItem, duration: newDuration };
            
            // Shift later items based on current end so resizing keeps neighbors in sync
            shiftLaterItems(newItems, currentEnd, diff, currentItem.id);

        } else {
            newItems[currentItemIndex] = { ...currentItem, duration: newDuration };
        }
        
        latestDragItemsRef.current = newItems;
        onUpdateItems(newItems, { deferCommit: true });
      } else if (dragState.action === 'resize-left') {
        let newStart = roundToStep(dragState.originalOffset + snappedDelta, snap);
        let newDuration = roundToStep(dragState.originalDuration - snappedDelta, snap);

        if (newDuration < (isTravel ? 0.05 : 0.5)) {
            newDuration = isTravel ? 0.05 : 0.5;
            newStart = roundToStep(dragState.originalOffset + dragState.originalDuration - newDuration, snap);
        }

        if (newStart < 0) newStart = 0;

        if (Math.abs(currentItem.startDateOffset - newStart) < 0.000001) return;

        const prevCity = newItems.find(i => i.type === 'city' && i.startDateOffset < currentItem.startDateOffset && i.id !== currentItem.id);
        if (prevCity && currentItem.type === 'city') {
            const prevEnd = prevCity.startDateOffset + prevCity.duration;
            if (newStart < prevEnd) {
                newStart = roundToStep(prevEnd, snap);
                newDuration = roundToStep((dragState.originalOffset + dragState.originalDuration) - newStart, snap);
            }
        }

        newItems[currentItemIndex] = { 
            ...currentItem, 
            startDateOffset: newStart,
            duration: newDuration
        };

        latestDragItemsRef.current = newItems;
        onUpdateItems(newItems, { deferCommit: true });
      }
    };

    const shiftLaterItems = (items: ITimelineItem[], thresholdStart: number, diff: number, excludeId: string) => {
         const epsilon = 0.051; // include items attached at the boundary (e.g. travel at end)
         items.forEach((item, idx) => {
             // Shift cities after this one
             if (item.type === 'city' && item.startDateOffset >= (thresholdStart - epsilon) && item.id !== excludeId) {
                 items[idx].startDateOffset += diff;
             }
             // Shift travel/activities roughly attached
             if ((item.type === 'travel' || item.type === 'travel-empty' || item.type === 'activity') && item.startDateOffset >= (thresholdStart - epsilon)) {
                  items[idx].startDateOffset += diff;
             }
         });
    }

    const handlePointerUp = () => {
      // Check the Ref for the source of truth regarding drag status
      if (isDraggingRef.current) {
        ignoreClickRef.current = true;
        if (latestDragItemsRef.current) {
          onUpdateItems(latestDragItemsRef.current, { deferCommit: false });
        }
      }
      
      // Reset everything
      isDraggingRef.current = false;
      dragStartItemsRef.current = null;
      latestDragItemsRef.current = null;
      setDragState({
        isDragging: false,
        itemId: null,
        action: null,
        startX: 0,
        originalOffset: 0,
        originalDuration: 0
      });
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [dragState, trip.items, onUpdateItems, pixelsPerDay]);


  // --- Render Helpers ---

  // Determine Zoom Level aesthetics
  const isZoomedOut = pixelsPerDay < 60;

  // Process Dates for Headers
  const dateHeaders = React.useMemo(() => {
    const baseStartDate = parsedTripStartDate || new Date(trip.startDate);
    const days = Array.from({ length: tripLength }).map((_, i) => {
        const dayOffset = visualStartOffset + i;
        const date = addDays(baseStartDate, dayOffset);
        return { 
            index: i,
            dayOffset,
            date,
            isToday: i === todayColumnIndex,
            isWeekend: date.getDay() === 0 || date.getDay() === 6,
            dayName: date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
            dayNum: date.getDate(),
            monthName: date.toLocaleDateString('en-US', { month: 'long' }),
            monthShort: date.toLocaleDateString('en-US', { month: 'short' })
        };
    });

    if (!isZoomedOut) return { view: 'detailed', days };

    // Group by month for Zoomed Out view
    const months = [];
    let currentMonth = null;
    let monthStartIndex = 0;

    days.forEach((day, i) => {
        if (day.monthName !== currentMonth) {
            if (currentMonth) {
                months.push({ 
                    name: currentMonth, 
                    startIndex: monthStartIndex, 
                    width: i - monthStartIndex 
                });
            }
            currentMonth = day.monthName;
            monthStartIndex = i;
        }
    });
    // Add last month
    if (currentMonth) {
        months.push({ 
            name: currentMonth, 
            startIndex: monthStartIndex, 
            width: days.length - monthStartIndex 
        });
    }

    return { view: 'grouped', days, months };
  }, [parsedTripStartDate, trip.startDate, tripLength, isZoomedOut, todayColumnIndex]);

  useEffect(() => {
    if (!selectedItemId) return;
    if (lastAutoScrollSelectionRef.current === selectedItemId) return;

    const targetItem = trip.items.find(item => item.id === selectedItemId);
    if (!targetItem || !containerRef.current) return;

    const container = containerRef.current;
    const targetCenter = ((targetItem.startDateOffset - visualStartOffset + (targetItem.duration / 2)) * pixelsPerDay) + 32;
    const visibleStart = container.scrollLeft + 80;
    const visibleEnd = container.scrollLeft + container.clientWidth - 80;

    if (targetCenter >= visibleStart && targetCenter <= visibleEnd) {
        lastAutoScrollSelectionRef.current = selectedItemId;
        return;
    }

    container.scrollTo({
        left: Math.max(0, targetCenter - (container.clientWidth / 2)),
        behavior: 'smooth',
    });
    lastAutoScrollSelectionRef.current = selectedItemId;
  }, [selectedItemId, trip.items, pixelsPerDay, visualStartOffset]);

  return (
    <div 
      className="w-full h-full overflow-auto bg-white relative timeline-scroll" 
      ref={containerRef}
      onClick={() => handleBlockSelect(null)}
    >
        <div className="relative min-h-full" style={{ minWidth: '100%', width: `${totalWidth}px` }}>
            {todayColumnIndex !== null && (
                <>
                    <div
                        className="absolute top-0 bottom-0 pointer-events-none z-[2]"
                        style={{
                            left: `${32 + (todayColumnIndex * pixelsPerDay)}px`,
                            width: `${pixelsPerDay}px`,
                        }}
                        aria-hidden="true"
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-red-50/40 via-red-50/15 to-red-50/40" />
                    </div>
                    <div
                        className="absolute top-0 bottom-0 pointer-events-none z-[25]"
                        style={{
                            left: `${32 + (todayColumnIndex * pixelsPerDay)}px`,
                            width: `${pixelsPerDay}px`,
                        }}
                        aria-hidden="true"
                    >
                        <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-px bg-red-400/60" />
                        <span className="absolute top-1 left-1/2 -translate-x-1/2 rounded-full border border-red-200/90 bg-white/90 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-red-500 shadow-sm">
                            Today
                        </span>
                    </div>
                </>
            )}
            
            {/* Header (Adaptive) */}
            <div className={`border-b border-gray-200 flex flex-col sticky top-0 bg-white/95 backdrop-blur z-20 shadow-sm pl-8 transition-all duration-200 ${isZoomedOut ? 'h-20' : 'h-16'}`}>
                
                {dateHeaders.view === 'detailed' ? (
                    // Detailed View: Single Row per Day
                     <div className="flex h-full">
                        {dateHeaders.days.map((day) => (
                            <div 
                                key={day.index} 
                                className={`flex-shrink-0 border-r border-gray-100 flex flex-col justify-center px-2 select-none relative
                                    ${day.isToday ? 'bg-red-50/70' : day.isWeekend ? 'bg-gray-50' : 'bg-white'}
                                `}
                                style={{ width: `${pixelsPerDay}px` }}
                            >
                                <span className={`text-xs font-bold ${day.isToday ? 'text-red-500' : day.isWeekend ? 'text-red-400' : 'text-gray-400'}`}>
                                    {day.dayName}
                                </span>
                                <span className={`text-sm font-semibold whitespace-nowrap ${day.isToday ? 'text-red-700' : 'text-gray-700'}`}>
                                    {day.dayNum} {day.monthShort}
                                </span>
                            </div>
                        ))}
                    </div>
                ) : (
                    // Grouped View: Month Row + Day Row
                    <div className="flex flex-col h-full">
                        {/* Month Row */}
                        <div className="flex border-b border-gray-100 h-8 overflow-hidden bg-accent-50">
                             {dateHeaders.months?.map((month, idx) => (
                                 <div 
                                    key={idx}
                                    className="flex-shrink-0 flex items-center justify-center font-bold text-xs uppercase tracking-widest text-accent-900 border-r border-accent-100 bg-accent-50 last:border-0"
                                    style={{ width: `${month.width * pixelsPerDay}px` }}
                                 >
                                     {month.name}
                                 </div>
                             ))}
                        </div>
                        {/* Day Row */}
                        <div className="flex flex-1">
                            {dateHeaders.days.map((day) => (
                                <div 
                                    key={day.index} 
                                    className={`flex-shrink-0 border-r border-gray-100 flex items-center justify-center select-none relative
                                        ${day.isToday ? 'bg-red-50/70' : day.isWeekend ? 'bg-gray-50' : 'bg-white'}
                                    `}
                                    style={{ width: `${pixelsPerDay}px` }}
                                >
                                    <span className={`text-xs font-semibold ${day.isToday ? 'text-red-600' : day.isWeekend ? 'text-red-500' : 'text-gray-600'}`}>
                                        {day.dayNum}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Grid Background Lines */}
            <div className={`absolute bottom-0 left-8 right-0 pointer-events-none flex z-0 ${isZoomedOut ? 'top-20' : 'top-16'}`}>
                {Array.from({ length: tripLength }).map((_, i) => (
                    <div 
                        key={i} 
                        className="flex-shrink-0 border-r border-dashed border-gray-100 h-full"
                        style={{ width: `${pixelsPerDay}px` }}
                    />
                ))}
            </div>

            {/* Content Area with PADDING */}
            <div className="pt-8 pb-32 pl-8 pr-8 space-y-8 relative z-10">
                
                {/* Cities Lane */}
                <div className="relative h-32 w-full group/cities">
                    {/* Lane Label */}
                    <div className="sticky left-0 mb-2 flex items-center justify-between z-20 w-64 pointer-events-auto">
                         <span className="text-xs font-bold text-gray-400 uppercase tracking-widest bg-white/80 pr-2 backdrop-blur-sm rounded">
                             Cities & Stays
                         </span>
                         <button 
                            onClick={(e) => { e.stopPropagation(); if (!canEdit) return; onAddCity(); }}
                            disabled={!canEdit}
                            className={`opacity-0 group-hover/cities:opacity-100 transition-opacity bg-accent-100 text-accent-700 rounded-full p-1 ${canEdit ? 'hover:bg-accent-200' : 'opacity-50 cursor-not-allowed'}`}
                            aria-label="Add city to end"
                        >
                             <Plus size={14} />
                        </button>
                    </div>
                    <div className="relative h-28 w-full">
                        {cities.map((city, index) => {
                            // Calculate Neighbors
                            const prev = index > 0 ? cities[index - 1] : null;
                            const next = index < cities.length - 1 ? cities[index + 1] : null;
                            
                            const idealStart = prev ? prev.startDateOffset + prev.duration : 0;
                            const startDiff = Math.abs(city.startDateOffset - idealStart);
                            
                            let endDiff = 0;
                            if (next) {
                                const currentEnd = city.startDateOffset + city.duration;
                                endDiff = Math.abs(next.startDateOffset - currentEnd);
                            }
                            
                            const hasGapOrOverlap = startDiff > 0.05 || endDiff > 0.05;
                            const prevEnd = prev ? prev.startDateOffset + prev.duration : 0;
                            const nextStart = next ? next.startDateOffset : null;
                            const currentStart = city.startDateOffset;
                            const currentEnd = city.startDateOffset + city.duration;
                            const gapBefore = currentStart > prevEnd + 0.05;
                            const overlapBefore = currentStart < prevEnd - 0.05;
                            const gapAfter = nextStart !== null ? currentEnd < nextStart - 0.05 : false;
                            const overlapAfter = nextStart !== null ? currentEnd > nextStart + 0.05 : false;
                            const shouldShowForceFill = hasGapOrOverlap || overlapBefore || overlapAfter || gapBefore || gapAfter;
                            const forceFillMode = shouldShowForceFill ? ((overlapBefore && overlapAfter) ? 'shrink' : 'stretch') : undefined;
                            const forceFillLabel = shouldShowForceFill ? ((overlapBefore && overlapAfter) ? 'Occupy available space' : 'Stretch to fill space') : undefined;

                            return (
                                <TimelineBlock
                                    key={city.id}
                                    item={city}
                                    isSelected={selectedItemId === city.id || selectedCityIds.includes(city.id)}
                                    onSelect={handleBlockSelect}
                                    onResizeStart={handleResizeStart}
                                    onMoveStart={handleMoveStart}
                                    onForceFill={onForceFill}
                                    onSwapSelectedCities={onSwapSelectedCities}
                                    isCity={true}
                                    hasGapOrOverlap={shouldShowForceFill}
                                    forceFillMode={forceFillMode}
                                    forceFillLabel={forceFillLabel}
                                    showSwapSelectedButton={selectedCityIds.length > 1 && selectedCityIds.includes(city.id)}
                                    swapSelectedLabel="Reverse selected cities"
                                    pixelsPerDay={pixelsPerDay}
                                    timelineStartOffset={visualStartOffset}
                                    canEdit={canEdit}
                                />
                            );
                        })}
                    </div>
                </div>

                {/* Travel Lane */}
                 <div className="relative h-24 w-full group/travel">
                    <div className="sticky left-0 mb-1 flex items-center justify-between z-20 w-64 pointer-events-auto">
                         <span className="text-xs font-bold text-gray-400 uppercase tracking-widest bg-white/80 pr-2 backdrop-blur-sm rounded">
                             Travel
                         </span>
                         <button 
                            onClick={(e) => { e.stopPropagation(); if (!canEdit) return; handleAddTravel(); }}
                            disabled={!canEdit}
                            className={`opacity-0 group-hover/travel:opacity-100 transition-opacity bg-stone-100 text-stone-700 rounded-full p-1 ${canEdit ? 'hover:bg-stone-200' : 'opacity-50 cursor-not-allowed'}`}
                            aria-label="Add travel"
                        >
                             <Plus size={14} />
                        </button>
                    </div>
                    
                    <div className="relative h-20 w-full overflow-visible" ref={travelLaneRef}>
                        {travelLinks.map(link => {
                            const fromEnd = link.fromCity.startDateOffset + link.fromCity.duration;
                            const toStart = link.toCity.startDateOffset;
                            const left = (fromEnd - visualStartOffset) * pixelsPerDay;
                            const right = (toStart - visualStartOffset) * pixelsPerDay;
                            const width = Math.max(16, right - left);
                            const mid = left + width / 2;
                            const chipWidth = 140;
                            const chipLeft = Math.max(0, mid - chipWidth / 2);
                            const chipRight = chipLeft + chipWidth;
                            const travel = link.travelItem;
                            const mode = normalizeTransportMode(travel?.transportMode);
                            const isUnsetTransport = mode === 'na';
                            const isSelected = travel && selectedItemId === travel.id;
                            const durationHours = travel ? Math.round(travel.duration * 24 * 10) / 10 : null;
                            const connectorHeight = 10;
                            const connectorGap = 6;
                            const lineY = 8;
                            const lineAStart = left + connectorGap;
                            const lineAEnd = chipLeft - connectorGap;
                            const lineBStart = chipRight + connectorGap;
                            const lineBEnd = right - connectorGap;
                            const showLineA = lineAEnd > lineAStart;
                            const showLineB = lineBEnd > lineBStart;

                            return (
                                <div key={link.id} className="absolute top-2 bottom-2">
                                    {/* Vertical ticks down from city end/start */}
                                    <div className="absolute w-px bg-stone-200" style={{ left, top: 0, height: connectorHeight }} />
                                    <div className="absolute w-px bg-stone-200" style={{ left: right, top: 0, height: connectorHeight }} />

                                    {/* Connection lines from city -> transport chip */}
                                    {showLineA && (
                                        <div className="absolute h-0.5 bg-stone-200" style={{ left: lineAStart, width: lineAEnd - lineAStart, top: lineY }} />
                                    )}
                                    {showLineB && (
                                        <div className="absolute h-0.5 bg-stone-200" style={{ left: lineBStart, width: lineBEnd - lineBStart, top: lineY }} />
                                    )}

                                    {/* Main connection line between cities */}
                                    <div className="absolute top-1/2 -translate-y-1/2 h-0.5 bg-stone-100" style={{ left, width }} />
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleSelectOrCreateTravel(link.fromCity, link.toCity, travel); }}
                                        className={`absolute top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-full border text-xs font-semibold flex items-center gap-2 shadow-sm transition-colors
                                            ${isSelected ? 'bg-accent-50 border-accent-300 text-accent-700' : (isUnsetTransport ? 'bg-slate-50/70 border-slate-200 border-dashed text-slate-400' : 'bg-white border-gray-200 text-gray-600')}
                                            ${travel || canEdit ? 'hover:bg-gray-50 cursor-pointer' : 'cursor-not-allowed opacity-60'}
                                        `}
                                        style={{ left: chipLeft, width: chipWidth }}
                                        title={mode === 'na' ? 'Transport not decided' : `Transport: ${mode}`}
                                        disabled={!travel && !canEdit}
                                    >
                                        {!isUnsetTransport && (
                                            <span className="text-gray-500">{getTransportIcon(mode)}</span>
                                        )}
                                        <span className="uppercase tracking-wider">{mode === 'na' ? 'N/A' : mode}</span>
                                        {durationHours !== null && (
                                            <span className="text-[10px] font-normal text-gray-400 ml-auto">{durationHours}h</span>
                                        )}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Divider */}
                <div className="w-full border-t border-gray-100" />

                {/* Activities Lanes */}
                <div className="relative pt-2">
                    <div className="sticky left-0 mb-2 text-xs font-bold text-gray-400 uppercase tracking-widest bg-white/80 pr-2 backdrop-blur-sm rounded z-20 pointer-events-none w-fit">
                        Activities
                    </div>

                    {/* Day Column Add Buttons */}
                    <div className="relative h-8 w-full flex mb-2 pointer-events-none">
                         {Array.from({ length: tripLength }).map((_, i) => (
                             <div 
                                key={i}
                                className="absolute top-0 bottom-0 flex justify-center items-center pointer-events-auto group"
                                style={{ 
                                    left: `${i * pixelsPerDay}px`, 
                                    width: `${pixelsPerDay}px` 
                                }}
                             >
                                 <button
                                     onClick={(e) => { e.stopPropagation(); if (!canEdit) return; onAddActivity(dateHeaders.days[i]?.dayOffset ?? i); }}
                                     disabled={!canEdit}
                                     className={`w-full h-full mx-1 rounded-md border border-dashed border-transparent flex items-center justify-center text-gray-300 transition-all ${canEdit ? 'hover:border-gray-300 hover:bg-gray-50 hover:text-accent-500' : 'cursor-not-allowed opacity-40'}`}
                                     aria-label={`Add activity for ${dateHeaders.days[i]?.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) || `day ${i + 1}`}`}
                                 >
                                     <Plus size={16} />
                                 </button>
                             </div>
                         ))}
                    </div>
                    
                    <div className="flex flex-col gap-3">
                        {activityLanes.map((lane, laneIdx) => (
                             <div key={laneIdx} className="relative h-20 w-full group/lane rounded-lg border border-transparent">
                                {lane.map(item => (
                                    <TimelineBlock
                                        key={item.id}
                                        item={item}
                                        isSelected={selectedItemId === item.id}
                                        onSelect={handleBlockSelect}
                                        onResizeStart={handleResizeStart}
                                        onMoveStart={handleMoveStart}
                                        pixelsPerDay={pixelsPerDay}
                                        timelineStartOffset={visualStartOffset}
                                        canEdit={canEdit}
                                    />
                                ))}
                             </div>
                        ))}
                    </div>
                </div>

            </div>
        </div>
    </div>
  );
};
