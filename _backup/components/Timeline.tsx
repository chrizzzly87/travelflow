import React, { useRef, useState, useEffect } from 'react';
import { ITrip, ITimelineItem, IDragState } from '../types';
import { addDays, getTripDuration, TRAVEL_COLOR } from '../utils';
import { TimelineBlock } from './TimelineBlock';
import { Plus } from 'lucide-react';

interface TimelineProps {
  trip: ITrip;
  selectedItemId: string | null;
  onSelect: (id: string | null) => void;
  onUpdateItems: (items: ITimelineItem[]) => void;
  onAddActivity: (dayOffset: number) => void;
  onForceFill?: (id: string) => void;
  onAddCity: () => void;
  pixelsPerDay: number;
}

export const Timeline: React.FC<TimelineProps> = ({ trip, selectedItemId, onSelect, onUpdateItems, onAddActivity, onForceFill, onAddCity, pixelsPerDay }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const travelLaneRef = useRef<HTMLDivElement>(null);
  const ignoreClickRef = useRef<boolean>(false);
  
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

  const tripLength = getTripDuration(trip.items);
  const totalWidth = tripLength * pixelsPerDay;
  
  // Separate items into lanes
  const cities = trip.items.filter(i => i.type === 'city').sort((a, b) => a.startDateOffset - b.startDateOffset);
  const travelItems = trip.items.filter(i => i.type === 'travel' || i.type === 'travel-empty').sort((a, b) => a.startDateOffset - b.startDateOffset);
  const activities = trip.items.filter(i => i.type === 'activity');

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

  const handleBlockSelect = (id: string | null) => {
      // Prevent selection if we just finished dragging
      if (ignoreClickRef.current) {
          ignoreClickRef.current = false;
          return;
      }
      onSelect(id);
  };

  const handleAddTravel = () => {
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

  const createTravelItem = (startOffset: number, duration: number) => {
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
      if (!travelLaneRef.current) return;
      
      // Prevent ghost from showing up if we are hovering over an existing block
      const target = e.target as HTMLElement;
      if (target.closest('.timeline-block-item')) {
          setHoverTravelStart(null);
          return;
      }

      const rect = travelLaneRef.current.getBoundingClientRect();
      const offsetX = e.clientX - rect.left;
      const rawDay = offsetX / pixelsPerDay;
      
      // Calculate start time so that the block (duration=1.0) is centered on mouse
      // Center = Start + 0.5  =>  Start = Center - 0.5
      let start = rawDay - 0.5;
      
      // Snap to 0.5 increments
      const snapStep = 0.5;
      start = Math.round(start / snapStep) * snapStep;
      
      if (start < 0) start = 0;
      
      setHoverTravelStart(start);
  };

  const handleTravelMouseLeave = () => {
      setHoverTravelStart(null);
  };

  const handleTravelClick = () => {
      if (hoverTravelStart !== null) {
          createTravelItem(hoverTravelStart, 1.0);
          setHoverTravelStart(null);
      }
  };

  // --- Resize/Drag Logic ---

  const handleResizeStart = (e: React.MouseEvent, id: string, direction: 'left' | 'right') => {
    e.stopPropagation();
    const item = trip.items.find(i => i.id === id);
    if (!item) return;

    isDraggingRef.current = false;
    dragStartPosRef.current = e.clientX;

    setDragState({
      isDragging: false, 
      itemId: id,
      action: direction === 'left' ? 'resize-left' : 'resize-right',
      startX: e.clientX,
      originalOffset: item.startDateOffset,
      originalDuration: item.duration,
    });
  };

  const handleMoveStart = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const item = trip.items.find(i => i.id === id);
    if (!item) return;

    isDraggingRef.current = false;
    dragStartPosRef.current = e.clientX;

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
    const handleMouseMove = (e: MouseEvent) => {
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

      const currentItemIndex = trip.items.findIndex(i => i.id === dragState.itemId);
      if (currentItemIndex === -1) return;
      
      const currentItem = trip.items[currentItemIndex];
      const newItems = [...trip.items];

      const isTravel = currentItem.type === 'travel' || currentItem.type === 'travel-empty';
      const snap = isTravel ? 0.05 : 0.5;
      const snappedDelta = Math.round(deltaDays / snap) * snap;

      if (Math.abs(snappedDelta) === 0) return;

      if (dragState.action === 'move') {
          let newStart = dragState.originalOffset + snappedDelta;
          if (newStart < 0) newStart = 0;
          
          if (currentItem.startDateOffset === newStart) return;

          newItems[currentItemIndex] = { ...currentItem, startDateOffset: newStart };
          onUpdateItems(newItems);
      } 
      else if (dragState.action === 'resize-right') {
        const newDuration = Math.max(isTravel ? 0.05 : 0.5, dragState.originalDuration + snappedDelta);
        if (currentItem.duration === newDuration) return; 

        if (currentItem.type === 'city') {
            const diff = newDuration - currentItem.duration;
            newItems[currentItemIndex] = { ...currentItem, duration: newDuration };
            
            // Shift later items
            const oldEnd = dragState.originalOffset + dragState.originalDuration;
            shiftLaterItems(newItems, oldEnd - 0.05, diff, currentItem.id);

        } else {
            newItems[currentItemIndex] = { ...currentItem, duration: newDuration };
        }
        
        onUpdateItems(newItems);
      } else if (dragState.action === 'resize-left') {
        let newStart = dragState.originalOffset + snappedDelta;
        let newDuration = dragState.originalDuration - snappedDelta;

        if (newDuration < (isTravel ? 0.05 : 0.5)) {
            newDuration = isTravel ? 0.05 : 0.5;
            newStart = dragState.originalOffset + dragState.originalDuration - newDuration;
        }

        if (newStart < 0) newStart = 0;

        if (currentItem.startDateOffset === newStart) return;

        const prevCity = newItems.find(i => i.type === 'city' && i.startDateOffset < currentItem.startDateOffset && i.id !== currentItem.id);
        if (prevCity && currentItem.type === 'city') {
            const prevEnd = prevCity.startDateOffset + prevCity.duration;
            if (newStart < prevEnd) {
                newStart = prevEnd;
                newDuration = (dragState.originalOffset + dragState.originalDuration) - newStart;
            }
        }

        newItems[currentItemIndex] = { 
            ...currentItem, 
            startDateOffset: newStart,
            duration: newDuration
        };

        onUpdateItems(newItems);
      }
    };

    const shiftLaterItems = (items: ITimelineItem[], thresholdStart: number, diff: number, excludeId: string) => {
         items.forEach((item, idx) => {
             // Shift cities after this one
             if (item.type === 'city' && item.startDateOffset > thresholdStart && item.id !== excludeId) {
                 items[idx].startDateOffset += diff;
             }
             // Shift travel/activities roughly attached
             if ((item.type === 'travel' || item.type === 'travel-empty' || item.type === 'activity') && item.startDateOffset > thresholdStart) {
                  items[idx].startDateOffset += diff;
             }
         });
    }

    const handleMouseUp = () => {
      // Check the Ref for the source of truth regarding drag status
      if (isDraggingRef.current) {
        ignoreClickRef.current = true;
      }
      
      // Reset everything
      isDraggingRef.current = false;
      setDragState({
        isDragging: false,
        itemId: null,
        action: null,
        startX: 0,
        originalOffset: 0,
        originalDuration: 0
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, trip.items, onUpdateItems, pixelsPerDay]);


  return (
    <div 
      className="w-full h-full overflow-auto bg-white relative timeline-scroll" 
      ref={containerRef}
      onClick={() => handleBlockSelect(null)}
    >
        <div className="relative min-h-full" style={{ width: `${Math.max(totalWidth, window.innerWidth)}px` }}>
            
            {/* Header (Dates) */}
            <div className="h-16 border-b border-gray-200 flex sticky top-0 bg-white/95 backdrop-blur z-20 shadow-sm pl-8">
                {Array.from({ length: tripLength }).map((_, i) => {
                    const date = addDays(new Date(trip.startDate), i);
                    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                    return (
                        <div 
                            key={i} 
                            className={`flex-shrink-0 border-r border-gray-100 flex flex-col justify-center px-2 select-none group relative
                                ${isWeekend ? 'bg-gray-50' : 'bg-white'}
                            `}
                            style={{ width: `${pixelsPerDay}px` }}
                        >
                            <span className={`text-xs font-bold uppercase ${isWeekend ? 'text-red-400' : 'text-gray-400'}`}>
                                {date.toLocaleDateString('en-US', { weekday: 'short' })}
                            </span>
                            <span className="text-sm font-semibold text-gray-700">
                                {date.getDate()} {date.toLocaleDateString('en-US', { month: 'short' })}
                            </span>
                        </div>
                    );
                })}
            </div>

            {/* Grid Background Lines */}
            <div className="absolute top-16 bottom-0 left-8 right-0 pointer-events-none flex z-0">
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
                            onClick={(e) => { e.stopPropagation(); onAddCity(); }}
                            className="opacity-0 group-hover/cities:opacity-100 transition-opacity bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded-full p-1"
                            title="Add City to end"
                        >
                             <Plus size={14} />
                         </button>
                    </div>
                    <div className="relative h-28 w-full">
                        {cities.map((city, index) => {
                            // Calculate Neighbors and Gap/Overlap Status
                            const prev = index > 0 ? cities[index - 1] : null;
                            const next = index < cities.length - 1 ? cities[index + 1] : null;
                            
                            const idealStart = prev ? prev.startDateOffset + prev.duration : 0;
                            const startDiff = Math.abs(city.startDateOffset - idealStart);
                            
                            let endDiff = 0;
                            if (next) {
                                const currentEnd = city.startDateOffset + city.duration;
                                endDiff = Math.abs(next.startDateOffset - currentEnd);
                            }
                            
                            // Check if there is a meaningful gap or overlap (> 1.2 hours approx)
                            const hasGapOrOverlap = startDiff > 0.05 || endDiff > 0.05;

                            return (
                                <TimelineBlock
                                    key={city.id}
                                    item={city}
                                    isSelected={selectedItemId === city.id}
                                    onSelect={handleBlockSelect}
                                    onResizeStart={handleResizeStart}
                                    onMoveStart={handleMoveStart}
                                    onForceFill={onForceFill}
                                    isCity={true}
                                    hasGapOrOverlap={hasGapOrOverlap}
                                    pixelsPerDay={pixelsPerDay}
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
                            onClick={(e) => { e.stopPropagation(); handleAddTravel(); }}
                            className="opacity-0 group-hover/travel:opacity-100 transition-opacity bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-full p-1"
                            title="Add Travel"
                        >
                             <Plus size={14} />
                         </button>
                    </div>
                    
                    <div 
                        className="relative h-20 w-full cursor-pointer" 
                        ref={travelLaneRef}
                        onMouseMove={handleTravelMouseMove}
                        onMouseLeave={handleTravelMouseLeave}
                        onClick={handleTravelClick}
                    >
                        {/* Ghost Block */}
                        {hoverTravelStart !== null && (
                             <div 
                                 className="absolute top-1 bottom-1 bg-stone-500/20 border-2 border-dashed border-stone-400/50 rounded-lg pointer-events-none z-0 transition-all duration-75 ease-out"
                                 style={{
                                     left: `${hoverTravelStart * pixelsPerDay}px`,
                                     width: `${1.0 * pixelsPerDay}px`
                                 }}
                             >
                                 <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-stone-500 uppercase tracking-wider opacity-60">
                                     + Add
                                 </div>
                             </div>
                        )}

                        {travelItems.map(item => (
                            <TimelineBlock
                                key={item.id}
                                item={item}
                                isSelected={selectedItemId === item.id}
                                onSelect={handleBlockSelect}
                                onResizeStart={handleResizeStart}
                                onMoveStart={handleMoveStart}
                                pixelsPerDay={pixelsPerDay}
                            />
                        ))}
                    </div>
                </div>

                {/* Divider */}
                <div className="w-full border-t border-gray-100" />

                {/* Activities Lanes */}
                <div className="relative pt-2">
                    <div className="sticky left-0 mb-2 text-xs font-bold text-gray-400 uppercase tracking-widest bg-white/80 pr-2 backdrop-blur-sm rounded z-20 pointer-events-none w-fit">
                        Activities
                    </div>

                    {/* Day Column Add Buttons - Positioned in a row above activities */}
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
                                     onClick={(e) => { e.stopPropagation(); onAddActivity(i); }}
                                     className="w-full h-full mx-1 rounded-md border border-dashed border-transparent hover:border-gray-300 hover:bg-gray-50 flex items-center justify-center text-gray-300 hover:text-indigo-500 transition-all"
                                     title={`Add activity for day ${i + 1}`}
                                 >
                                     <Plus size={16} />
                                 </button>
                             </div>
                         ))}
                    </div>
                    
                    <div className="flex flex-col gap-3">
                        {activityLanes.map((lane, laneIdx) => (
                             <div key={laneIdx} className="relative h-20 w-full group/lane hover:bg-gray-50 transition-colors rounded-lg border border-transparent hover:border-gray-100">
                                {lane.map(item => (
                                    <TimelineBlock
                                        key={item.id}
                                        item={item}
                                        isSelected={selectedItemId === item.id}
                                        onSelect={handleBlockSelect}
                                        onResizeStart={handleResizeStart}
                                        onMoveStart={handleMoveStart}
                                        pixelsPerDay={pixelsPerDay}
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