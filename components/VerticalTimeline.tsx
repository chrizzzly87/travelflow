import React, { useRef, useState, useEffect } from 'react';
import { ITrip, ITimelineItem, IDragState } from '../types';
import { addDays, buildCityOverlapLayout, findTravelBetweenCities, getHexFromColorClass, getTimelineBounds, TRAVEL_COLOR, TRAVEL_EMPTY_COLOR } from '../utils';
import { TimelineBlock } from './TimelineBlock';
import { Plus } from 'lucide-react';
import { TransportModeIcon } from './TransportModeIcon';
import { normalizeTransportMode } from '../shared/transportModes';
import { getExampleCityLaneViewTransitionName } from '../shared/viewTransitionNames';

interface VerticalTimelineProps {
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
  enableExampleSharedTransition?: boolean;
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

export const VerticalTimeline: React.FC<VerticalTimelineProps> = ({
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
  readOnly = false,
  enableExampleSharedTransition = false
}) => {
  const canEdit = !readOnly;
  const containerRef = useRef<HTMLDivElement>(null);
  const travelLaneRef = useRef<HTMLDivElement>(null);
  const ignoreClickRef = useRef<boolean>(false);
  const dragStartItemsRef = useRef<ITimelineItem[] | null>(null);
  const latestDragItemsRef = useRef<ITimelineItem[] | null>(null);
  const lastAutoScrollSelectionRef = useRef<string | null>(null);
  
  // Use Refs for synchronous drag tracking
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
  const totalHeight = tripLength * pixelsPerDay;
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

  const todayRowIndex = React.useMemo(() => {
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
  
  const cities = trip.items.filter(i => i.type === 'city').sort((a, b) => a.startDateOffset - b.startDateOffset);
  const travelItems = trip.items.filter(i => i.type === 'travel' || i.type === 'travel-empty').sort((a, b) => a.startDateOffset - b.startDateOffset);
  const activities = trip.items.filter(i => i.type === 'activity');
  const cityStackLayout = React.useMemo(() => buildCityOverlapLayout(cities), [cities]);
  const connectorCities = React.useMemo(
      () => cities
          .filter((city) => (cityStackLayout.get(city.id)?.stackIndex || 0) === 0)
          .sort((a, b) => a.startDateOffset - b.startDateOffset),
      [cities, cityStackLayout]
  );
  const uncertainSlotColorByKey = React.useMemo(() => {
      const colorBySlot = new Map<string, string>();
      cities.forEach((city) => {
          if (city.cityPlanStatus !== 'uncertain') return;
          const stack = cityStackLayout.get(city.id);
          const optionKey = (typeof city.cityPlanOptionIndex === 'number' && Number.isFinite(city.cityPlanOptionIndex))
              ? `option-${city.cityPlanOptionIndex}`
              : `stack-${stack?.stackIndex || 0}`;
          const slotKey = `${city.cityPlanGroupId || 'global'}:${optionKey}`;
          if (!colorBySlot.has(slotKey)) {
              colorBySlot.set(slotKey, getHexFromColorClass(city.color || ''));
          }
      });
      return colorBySlot;
  }, [cities, cityStackLayout]);

  const travelLinks = React.useMemo(() => {
      return connectorCities.slice(0, -1).map((city, idx) => {
          const nextCity = connectorCities[idx + 1];
          const travelItem = findTravelBetweenCities(trip.items, city, nextCity);
          return {
              id: travelItem?.id || `travel-link-${city.id}-${nextCity.id}`,
              fromCity: city,
              toCity: nextCity,
              travelItem
          };
      });
  }, [connectorCities, trip.items]);

  const getTransportIcon = (mode?: string) => {
      return <TransportModeIcon mode={mode} size={12} />;
  };

  // Vertical packing logic for activities
  // Similar to horizontal but we think in Y axis
  const activityLanes: ITimelineItem[][] = [];
  activities.sort((a, b) => {
      if (a.startDateOffset === b.startDateOffset) return b.duration - a.duration;
      return a.startDateOffset - b.startDateOffset;
  }).forEach(item => {
    let placed = false;
    for (const lane of activityLanes) {
        const lastInLane = lane[lane.length - 1];
        if (lastInLane.startDateOffset + lastInLane.duration + 0.05 <= item.startDateOffset) {
            lane.push(item);
            placed = true;
            break;
        }
    }
    if (!placed) activityLanes.push([item]);
  });
  while (activityLanes.length < 1) activityLanes.push([]);

  // --- Actions ---

  const handleBlockSelect = (id: string | null, options?: { multi?: boolean; isCity?: boolean }) => {
      if (ignoreClickRef.current) {
          ignoreClickRef.current = false;
          return;
      }
      onSelect(id, options);
  };

  const handleAddTravel = () => {
    if (!canEdit) return;
    let newStart = 0;
    if (travelItems.length > 0) {
        const lastTravel = travelItems[travelItems.length - 1];
        newStart = lastTravel.startDateOffset + lastTravel.duration + 0.1;
    } else if (cities.length > 1) {
        newStart = cities[0].startDateOffset + cities[0].duration;
    }
    createTravelItem(newStart, 0.2); 
  };

  const createTravelItem = (startOffset: number, duration: number) => {
    if (!canEdit) return;
    const id = `travel-new-${Date.now()}`;
    const newTravel: ITimelineItem = {
        id,
        type: 'travel',
        title: 'New Transfer',
        startDateOffset: startOffset,
        duration: duration,
        color: TRAVEL_COLOR,
        description: 'Transfer segment',
        transportMode: 'car'
    };
    onUpdateItems([...trip.items, newTravel]);
    onSelect(id);
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
          title: `Transfer to ${toCity.title}`,
          startDateOffset: startOffset,
          duration: 0.2,
          color: TRAVEL_EMPTY_COLOR,
          description: 'Transport not set'
      };
      onUpdateItems([...trip.items, newItem]);
      onSelect(newItem.id);
  };

  // --- Travel Lane Interaction (Vertical) ---

  const handleTravelMouseMove = (e: React.MouseEvent) => {
      if (!canEdit) {
          if (hoverTravelStart !== null) setHoverTravelStart(null);
          return;
      }
      if (!travelLaneRef.current) return;
      const target = e.target as HTMLElement;
      if (target.closest('.timeline-block-item')) {
          setHoverTravelStart(null);
          return;
      }

      const rect = travelLaneRef.current.getBoundingClientRect();
      const offsetY = e.clientY - rect.top; // Vertical offset
      const rawDay = visualStartOffset + (offsetY / pixelsPerDay);
      
      let start = rawDay - 0.5;
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

  // --- Resize/Drag Logic (Vertical) ---
  // In vertical mode:
  // X axis -> Lane/Width (ignored for now for resize)
  // Y axis -> Time/Duration

  const handleResizeStart = (e: React.MouseEvent | React.PointerEvent, id: string, direction: 'left' | 'right') => {
    if (!canEdit) return;
    // direction 'left' maps to 'top' (start time), 'right' maps to 'bottom' (end time)
    e.stopPropagation();
    const item = trip.items.find(i => i.id === id);
    if (!item) return;

    isDraggingRef.current = false;
    dragStartPosRef.current = e.clientY; // Track Y
    dragStartItemsRef.current = trip.items.map(i => ({ ...i }));

    setDragState({
      isDragging: false, 
      itemId: id,
      action: direction === 'left' ? 'resize-left' : 'resize-right',
      startX: e.clientY,
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
    dragStartPosRef.current = e.clientY; // Track Y
    dragStartItemsRef.current = trip.items.map(i => ({ ...i }));

    setDragState({
      isDragging: false, 
      itemId: id,
      action: 'move',
      startX: e.clientY,
      originalOffset: item.startDateOffset,
      originalDuration: item.duration,
    });
  };

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (!dragState.itemId || !dragState.action) return;

      const deltaY = e.clientY - dragStartPosRef.current; // Vertical delta
      const deltaDays = deltaY / pixelsPerDay; 

      if (!isDraggingRef.current) {
        if (Math.abs(deltaY) < 5) return;
        isDraggingRef.current = true;
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

      // New Snapping Logic: Snap the TARGET value, not just the delta
      // This ensures we always land on the grid (e.g. 0, 0.5, 1.0) regardless of initial offset errors
      
      if (dragState.action === 'move') {
          const rawStart = dragState.originalOffset + deltaDays;
          let newStart = roundToStep(rawStart, snap);
          
          if (newStart < 0) newStart = 0;
          if (Math.abs(currentItem.startDateOffset - newStart) < 0.000001) return; // Float safety
          
          newItems[currentItemIndex] = { ...currentItem, startDateOffset: newStart };
          latestDragItemsRef.current = newItems;
          onUpdateItems(newItems, { deferCommit: true });
      } 
      else if (dragState.action === 'resize-right') { // Bottom resize
        const rawDuration = dragState.originalDuration + deltaDays;
        const minDuration = isTravel ? 0.05 : 0.5;
        const newDuration = Math.max(minDuration, roundToStep(rawDuration, snap));
        const diff = newDuration - dragState.originalDuration;
        
        if (Math.abs(diff) < 0.000001) return; 

        if (currentItem.type === 'city') {
            const currentEnd = dragState.originalOffset + dragState.originalDuration;
            newItems[currentItemIndex] = { ...currentItem, duration: newDuration };
            shiftLaterItems(newItems, currentEnd, diff, currentItem.id);
        } else {
            newItems[currentItemIndex] = { ...currentItem, duration: newDuration };
        }
        latestDragItemsRef.current = newItems;
        onUpdateItems(newItems, { deferCommit: true });
      } else if (dragState.action === 'resize-left') { // Top resize
        const rawStart = dragState.originalOffset + deltaDays;
        let newStart = roundToStep(rawStart, snap);
        
        // Calculate new duration based on locked end time
        const oldEnd = dragState.originalOffset + dragState.originalDuration;
        let newDuration = roundToStep(oldEnd - newStart, snap);

        if (newDuration < (isTravel ? 0.05 : 0.5)) {
            newDuration = isTravel ? 0.05 : 0.5;
            newStart = roundToStep(oldEnd - newDuration, snap);
        }
        if (newStart < 0) newStart = 0;
        
        if (Math.abs(currentItem.startDateOffset - newStart) < 0.000001) return;

        const prevCity = newItems.find(i => i.type === 'city' && i.startDateOffset < currentItem.startDateOffset && i.id !== currentItem.id);
        if (prevCity && currentItem.type === 'city') {
            const prevEnd = prevCity.startDateOffset + prevCity.duration;
            if (newStart < prevEnd) {
                newStart = roundToStep(prevEnd, snap);
                newDuration = roundToStep(oldEnd - newStart, snap);
            }
        }
        newItems[currentItemIndex] = { ...currentItem, startDateOffset: newStart, duration: newDuration };
        latestDragItemsRef.current = newItems;
        onUpdateItems(newItems, { deferCommit: true });
      }
    };

    const shiftLaterItems = (items: ITimelineItem[], thresholdStart: number, diff: number, excludeId: string) => {
         const epsilon = 0.051; // include items attached at the boundary (e.g. travel at end)
         items.forEach((item, idx) => {
             if (item.type === 'city' && item.startDateOffset >= (thresholdStart - epsilon) && item.id !== excludeId) {
                 items[idx].startDateOffset += diff;
             }
             if ((item.type === 'travel' || item.type === 'travel-empty' || item.type === 'activity') && item.startDateOffset >= (thresholdStart - epsilon)) {
                  items[idx].startDateOffset += diff;
             }
         });
    }

    const handlePointerUp = () => {
      if (isDraggingRef.current) {
        ignoreClickRef.current = true;
        if (latestDragItemsRef.current) {
          onUpdateItems(latestDragItemsRef.current, { deferCommit: false });
        }
      }
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

  // Determine Zoom Level aesthetics
  const isZoomedOut = pixelsPerDay < 50;

  useEffect(() => {
    if (!selectedItemId) return;
    if (lastAutoScrollSelectionRef.current === selectedItemId) return;

    const targetItem = trip.items.find(item => item.id === selectedItemId);
    if (!targetItem || !containerRef.current) return;

    const container = containerRef.current;
    const targetCenter = ((targetItem.startDateOffset - visualStartOffset + (targetItem.duration / 2)) * pixelsPerDay) + 32;
    const visibleStart = container.scrollTop + 80;
    const visibleEnd = container.scrollTop + container.clientHeight - 80;

    if (targetCenter >= visibleStart && targetCenter <= visibleEnd) {
        lastAutoScrollSelectionRef.current = selectedItemId;
        return;
    }

    container.scrollTo({
        top: Math.max(0, targetCenter - (container.clientHeight / 2)),
        behavior: 'smooth',
    });
    lastAutoScrollSelectionRef.current = selectedItemId;
  }, [selectedItemId, trip.items, pixelsPerDay, visualStartOffset]);

  return (
    <div 
      className="h-full overflow-auto bg-white relative timeline-scroll" 
      ref={containerRef}
      onClick={() => handleBlockSelect(null)}
    >
        <div className="relative flex" style={{ height: `${Math.max(totalHeight, 800)}px` }}>
            {todayRowIndex !== null && (
                <>
                    <div
                        className="absolute left-0 right-0 pointer-events-none z-[2]"
                        style={{
                            top: `${32 + (todayRowIndex * pixelsPerDay)}px`,
                            height: `${pixelsPerDay}px`,
                        }}
                        aria-hidden="true"
                    >
                        <div className="absolute inset-0 bg-gradient-to-b from-red-50/40 via-red-50/15 to-red-50/40" />
                    </div>
                    <div
                        className="absolute left-0 right-0 pointer-events-none z-[25]"
                        style={{
                            top: `${32 + (todayRowIndex * pixelsPerDay)}px`,
                            height: `${pixelsPerDay}px`,
                        }}
                        aria-hidden="true"
                    >
                        <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-px bg-red-400/60" />
                        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-red-200/90 bg-white/90 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-red-500 shadow-sm">
                            Today
                        </span>
                    </div>
                </>
            )}
            
            {/* Header (Dates) - Vertical Column */}
            <div className="w-16 flex-shrink-0 border-r border-gray-200 bg-white z-20 shadow-sm sticky left-0 flex flex-col h-full">
                {/* Header matches Stays/Travel/Activities headers */}
                <div className="sticky top-0 h-8 flex items-center justify-center z-40 bg-white/95 backdrop-blur border-b border-gray-100 flex-shrink-0">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Day</span>
                </div>

                <div className="relative w-full flex-1">
                    {Array.from({ length: tripLength }).map((_, i) => {
                        const date = addDays(parsedTripStartDate || new Date(trip.startDate), visualStartOffset + i);
                        const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                        const isToday = i === todayRowIndex;
                        
                        return (
                            <div 
                                key={i} 
                                className={`flex-shrink-0 border-b border-gray-100 flex flex-col justify-center px-1 select-none group absolute w-full
                                    ${isToday ? 'bg-red-50/70' : isWeekend ? 'bg-gray-50' : 'bg-white'}
                                `}
                                style={{ 
                                    height: `${pixelsPerDay}px`,
                                    top: `${i * pixelsPerDay}px`,
                                    left: 0
                                }}
                            >
                                {isZoomedOut ? (
                                    // Compact View: "M  12"
                                    <div className="flex items-center justify-between w-full px-1">
                                        <span className={`text-xs font-bold uppercase ${isToday ? 'text-red-500' : isWeekend ? 'text-red-400' : 'text-gray-400'}`}>
                                            {date.toLocaleDateString('en-US', { weekday: 'narrow' })}
                                        </span>
                                        <span className={`text-sm font-semibold ${isToday ? 'text-red-700' : 'text-gray-700'}`}>
                                            {date.getDate()}
                                        </span>
                                    </div>
                                ) : (
                                    // Detailed View (Standard)
                                    <div className="text-center">
                                        <span className={`text-[10px] font-bold uppercase block leading-none ${isToday ? 'text-red-500' : isWeekend ? 'text-red-400' : 'text-gray-400'}`}>
                                            {date.toLocaleDateString('en-US', { weekday: 'short' })}
                                        </span>
                                        <span className={`text-lg font-bold block leading-tight ${isToday ? 'text-red-700' : 'text-gray-700'}`}>
                                            {date.getDate()}
                                        </span>
                                        <span className={`text-[10px] uppercase leading-none ${isToday ? 'text-red-500' : 'text-gray-400'}`}>
                                            {date.toLocaleDateString('en-US', { month: 'short' })}
                                        </span>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Grid Background Lines (Horizontal) */}
            <div className="absolute top-8 bottom-0 left-16 right-0 pointer-events-none flex flex-col z-0">
                {Array.from({ length: tripLength }).map((_, i) => (
                    <div 
                        key={i} 
                        className="flex-shrink-0 border-b border-dashed border-gray-100 w-full"
                        style={{ height: `${pixelsPerDay}px` }}
                    />
                ))}
            </div>

            {/* Content Area - Columns */}
            <div className="flex-1 flex flex-row h-full relative z-10">
                
                {/* Cities Column */}
                <div className="relative w-32 border-r border-gray-100 group/cities">
                     {/* Sticky Header */}
                     <div className="sticky top-0 h-8 flex items-center justify-center z-30 bg-white/90 backdrop-blur w-full border-b border-gray-100">
                         <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Stays</span>
                         <button 
                             onClick={(e) => { e.stopPropagation(); if (!canEdit) return; onAddCity(); }}
                             disabled={!canEdit}
                             className={`opacity-0 group-hover/cities:opacity-100 transition-opacity ml-1 bg-accent-50 text-accent-600 rounded-full p-0.5 ${canEdit ? 'hover:bg-accent-100' : 'opacity-50 cursor-not-allowed'}`}
                         >
                             <Plus size={12} />
                         </button>
                     </div>

                     <div className="relative w-full h-full">
                         {cities.map((city, index) => {
                             const cityStack = cityStackLayout.get(city.id);
                             const optionKey = (typeof city.cityPlanOptionIndex === 'number' && Number.isFinite(city.cityPlanOptionIndex))
                                 ? `option-${city.cityPlanOptionIndex}`
                                 : `stack-${cityStack?.stackIndex || 0}`;
                             const uncertainSlotKey = `${city.cityPlanGroupId || 'global'}:${optionKey}`;
                             const cityVisualColorHex = city.cityPlanStatus === 'uncertain'
                                 ? uncertainSlotColorByKey.get(uncertainSlotKey)
                                 : undefined;
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
                                     vertical={true}
                                     canEdit={canEdit}
                                     viewTransitionName={getExampleCityLaneViewTransitionName(enableExampleSharedTransition, index)}
                                     cityStackIndex={cityStack?.stackIndex || 0}
                                     cityStackCount={cityStack?.stackCount || 1}
                                     cityVisualColorHex={cityVisualColorHex}
                                 />
                             );
                         })}
                     </div>
                </div>

                {/* Travel Column */}
                <div className="relative w-16 border-r border-gray-100 group/travel overflow-visible">
                     <div className="sticky top-0 h-8 flex items-center justify-center z-30 bg-white/90 backdrop-blur w-full border-b border-gray-100">
                         <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Transfer</span>
                         <button 
                             onClick={(e) => { e.stopPropagation(); if (!canEdit) return; handleAddTravel(); }}
                             disabled={!canEdit}
                             className={`opacity-0 group-hover/travel:opacity-100 transition-opacity ml-1 bg-stone-100 text-stone-600 rounded-full p-0.5 ${canEdit ? 'hover:bg-stone-200' : 'opacity-50 cursor-not-allowed'}`}
                             aria-label="Add transfer"
                             title="Add transfer"
                         >
                              <Plus size={12} />
                          </button>
                     </div>

                    <div className="relative w-full h-full overflow-visible" ref={travelLaneRef}>
                         {travelLinks.map(link => {
                             const fromEnd = link.fromCity.startDateOffset + link.fromCity.duration;
                             const toStart = link.toCity.startDateOffset;
                             const top = (fromEnd - visualStartOffset) * pixelsPerDay;
                             const bottom = (toStart - visualStartOffset) * pixelsPerDay;
                             const height = Math.max(16, bottom - top);
                             const mid = top + height / 2;
                             const chipHeight = 36;
                             const chipTop = Math.max(0, mid - chipHeight / 2);
                             const chipBottom = chipTop + chipHeight;
                             const travel = link.travelItem;
                             const mode = normalizeTransportMode(travel?.transportMode);
                             const isUnsetTransport = mode === 'na';
                             const isSelected = travel && selectedItemId === travel.id;
                             const durationHours = travel ? Math.round(travel.duration * 24 * 10) / 10 : null;
                             const connectorWidth = 14;
                             const connectorGap = 4;

                             return (
                                 <div key={link.id} className="absolute left-0 right-0">
                                     {/* Horizontal ticks from city column into travel column */}
                                     <div className="absolute h-px bg-stone-200" style={{ top, left: -connectorWidth, width: connectorWidth }} />
                                     <div className="absolute h-px bg-stone-200" style={{ top: bottom, left: -connectorWidth, width: connectorWidth }} />

                                     {/* Connect chip top/bottom to city edge */}
                                     <div className="absolute h-px bg-stone-200" style={{ top: chipTop, left: -connectorWidth, width: connectorWidth - connectorGap }} />
                                     <div className="absolute h-px bg-stone-200" style={{ top: chipBottom, left: -connectorWidth, width: connectorWidth - connectorGap }} />

                                     {/* Main connection line between cities */}
                                     <div className="absolute left-1/2 -translate-x-1/2 w-0.5 bg-stone-100" style={{ top, height }} />
                                     <button
                                         onClick={(e) => { e.stopPropagation(); handleSelectOrCreateTravel(link.fromCity, link.toCity, travel); }}
                                         className={`absolute left-1/2 -translate-x-1/2 px-2 py-1 rounded-lg border text-[10px] font-semibold flex flex-col items-center gap-1 shadow-sm transition-colors
                                             ${isSelected ? 'bg-accent-50 border-accent-300 text-accent-700' : (isUnsetTransport ? 'bg-slate-50/70 border-slate-200 border-dashed text-slate-400' : 'bg-white border-gray-200 text-gray-600')}
                                             ${travel || canEdit ? 'hover:bg-gray-50 cursor-pointer' : 'cursor-not-allowed opacity-60'}
                                         `}
                                         style={{ top: chipTop, height: chipHeight, width: 46 }}
                                         title={mode === 'na' ? 'Transport not decided' : `Transport: ${mode}`}
                                         disabled={!travel && !canEdit}
                                     >
                                         {!isUnsetTransport && (
                                             <span className="text-gray-500">{getTransportIcon(mode)}</span>
                                         )}
                                         <span className="uppercase">{mode === 'na' ? 'N/A' : mode}</span>
                                         {durationHours !== null && (
                                             <span className="text-[9px] font-normal text-gray-400">{durationHours}h</span>
                                         )}
                                     </button>
                                 </div>
                             );
                         })}
                    </div>
                </div>

                {/* Activities Column (Expands) */}
                {/* Activities Column (Expands) */}
                <div className="flex-1 relative min-w-[200px] group/activities">
                     <div className="sticky top-0 h-8 flex items-center justify-center z-30 bg-white/90 backdrop-blur w-full border-b border-gray-100">
                         <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Activities</span>
                         <button 
                             onClick={(e) => { e.stopPropagation(); if (!canEdit) return; onAddActivity(visualStartOffset); }}
                             disabled={!canEdit}
                             className={`opacity-0 group-hover/activities:opacity-100 transition-opacity ml-1 bg-accent-50 text-accent-600 rounded-full p-0.5 ${canEdit ? 'hover:bg-accent-100' : 'opacity-50 cursor-not-allowed'}`}
                             aria-label="Add activity"
                         >
                             <Plus size={12} />
                         </button>
                     </div>
                     
                     {/* Add Buttons per Day (Horizontal Overlay strips?) No, tricky in vertical. 
                         Maybe hover overlay on the main grid?
                         For now, let's just render the blocks.
                     */}
                     
                     <div className="flex flex-row gap-2 h-full p-2">
                         {activityLanes.map((lane, laneIdx) => (
                             <div key={laneIdx} className="relative w-full h-full min-w-[100px] rounded-lg border border-transparent">
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
                                         vertical={true}
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
