import React, { useRef, useState, useEffect } from 'react';
import { ITrip, ITimelineItem, IDragState, TransportMode, ActivityType } from '../types';
import { getTripDuration, addDays, TRAVEL_COLOR } from '../utils';
import { Plane, Train, Bus, Ship, Car, Plus, Utensils, Camera, Coffee, Landmark, Music, Map as MapIcon, Dumbbell, Mountain, PawPrint, ShoppingBag, Compass, Palmtree, Leaf, MousePointerClick } from 'lucide-react';

interface VerticalTimelineProps {
    trip: ITrip;
    selectedItemId: string | null;
    onSelect: (id: string | null) => void;
    onUpdateItems: (items: ITimelineItem[]) => void;
    onForceFill?: (id: string) => void;
    onAddCity: () => void;
    onAddActivity: (dayOffset: number) => void;
    pixelsPerDay: number;
}

const TransportIcon = ({ mode, className }: { mode?: string, className?: string }) => {
    switch(mode) {
        case 'plane': return <Plane size={16} className={className} />;
        case 'train': return <Train size={16} className={className} />;
        case 'bus': return <Bus size={16} className={className} />;
        case 'boat': return <Ship size={16} className={className} />;
        case 'car': return <Car size={16} className={className} />;
        default: return <Plane size={16} className={className} />;
    }
}

const ActivityIcon = ({ type, className }: { type?: string, className?: string }) => {
    // Handle array or string
    const t = Array.isArray(type) ? type[0] : type;
    switch(t) {
        case 'food': return <Utensils size={14} className={className} />;
        case 'sightseeing': return <Camera size={14} className={className} />;
        case 'relaxation': return <Coffee size={14} className={className} />;
        case 'culture': return <Landmark size={14} className={className} />;
        case 'nightlife': return <Music size={14} className={className} />;
        case 'sports': return <Dumbbell size={14} className={className} />;
        case 'hiking': return <Mountain size={14} className={className} />;
        case 'wildlife': return <PawPrint size={14} className={className} />;
        case 'shopping': return <ShoppingBag size={14} className={className} />;
        case 'adventure': return <Compass size={14} className={className} />;
        case 'beach': return <Palmtree size={14} className={className} />;
        case 'nature': return <Leaf size={14} className={className} />;
        default: return <MapIcon size={14} className={className} />;
    }
}

export const VerticalTimeline: React.FC<VerticalTimelineProps> = ({ 
    trip, 
    selectedItemId, 
    onSelect, 
    onUpdateItems,
    onForceFill,
    onAddCity,
    onAddActivity,
    pixelsPerDay
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const travelLaneRef = useRef<HTMLDivElement>(null);
    const activityLaneRef = useRef<HTMLDivElement>(null);
    
    // --- Local State for Drag Performance ---
    const [optimisticItems, setOptimisticItems] = useState<ITimelineItem[] | null>(null);
    const itemsToRender = optimisticItems || trip.items;
    const latestItemsRef = useRef<ITimelineItem[]>(trip.items);

    // Ghost State
    const [hoverTravelStart, setHoverTravelStart] = useState<number | null>(null);
    const [hoverActivityStart, setHoverActivityStart] = useState<number | null>(null);

    const tripLength = getTripDuration(itemsToRender);
    const totalHeight = tripLength * pixelsPerDay;

    // Use Refs for synchronous drag tracking
    const isDraggingRef = useRef(false);
    const dragStartPosRef = useRef(0);

    const [dragState, setDragState] = useState<IDragState>({
        isDragging: false,
        itemId: null,
        action: null, // 'move', 'resize-top', 'resize-bottom'
        startX: 0, // Actually StartY in vertical context
        originalOffset: 0,
        originalDuration: 0,
    });

    // Helper to calculate exact visual position
    const getTop = (offset: number) => offset * pixelsPerDay;
    const getHeight = (duration: number) => Math.max(duration * pixelsPerDay, 40); // Min height 40px

    const handleSelect = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (!isDraggingRef.current) {
            onSelect(id);
        }
    };

    // --- Ghost / Add Logic ---

    const handleTravelMouseMove = (e: React.MouseEvent) => {
        if (!travelLaneRef.current) return;
        const target = e.target as HTMLElement;
        if (target.closest('.timeline-item')) {
            setHoverTravelStart(null);
            return;
        }
        const rect = travelLaneRef.current.getBoundingClientRect();
        const offsetY = e.clientY - rect.top + containerRef.current!.scrollTop; // Adjust for scroll if needed? 
        // Actually, sticky header might mess up scrollTop calc. Better to use clientY relative to rect.
        const relativeY = e.clientY - rect.top;
        
        let day = relativeY / pixelsPerDay;
        // Snap to nearest 0.1
        day = Math.round(day * 10) / 10;
        
        // Center the 2hr block
        const start = Math.max(0, day - (0.2 / 2)); // 0.2 duration
        setHoverTravelStart(start);
    };

    const handleActivityMouseMove = (e: React.MouseEvent) => {
        if (!activityLaneRef.current) return;
        const target = e.target as HTMLElement;
        if (target.closest('.timeline-item')) {
            setHoverActivityStart(null);
            return;
        }
        const rect = activityLaneRef.current.getBoundingClientRect();
        const relativeY = e.clientY - rect.top;
        
        let day = relativeY / pixelsPerDay;
        // Snap to nearest 0.25
        day = Math.round(day * 4) / 4;
        
        const start = Math.max(0, day);
        setHoverActivityStart(start);
    };

    const handleGhostClick = (type: 'travel' | 'activity') => {
        if (type === 'travel' && hoverTravelStart !== null) {
            const id = `travel-new-${Date.now()}`;
            const newTravel: ITimelineItem = {
                id,
                type: 'travel',
                title: 'New Travel',
                startDateOffset: hoverTravelStart,
                duration: 0.2, // ~5 hours visual
                color: TRAVEL_COLOR,
                description: 'Travel segment',
                transportMode: 'car'
            };
            onUpdateItems([...trip.items, newTravel]);
            onSelect(id);
            setHoverTravelStart(null);
        } else if (type === 'activity' && hoverActivityStart !== null) {
            // Open modal instead of direct add
            onAddActivity(hoverActivityStart);
            setHoverActivityStart(null);
        }
    };

    // --- Drag & Resize Logic ---

    const handleResizeStart = (e: React.MouseEvent, id: string, direction: 'top' | 'bottom') => {
        e.stopPropagation();
        e.preventDefault();
        const item = trip.items.find(i => i.id === id);
        if (!item) return;

        isDraggingRef.current = false;
        dragStartPosRef.current = e.clientY;
        latestItemsRef.current = trip.items; 

        setDragState({
            isDragging: false,
            itemId: id,
            action: direction === 'top' ? 'resize-left' : 'resize-right',
            startX: e.clientY,
            originalOffset: item.startDateOffset,
            originalDuration: item.duration,
        });
    };

    const handleMoveStart = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        e.preventDefault();
        const item = trip.items.find(i => i.id === id);
        if (!item) return;

        isDraggingRef.current = false;
        dragStartPosRef.current = e.clientY;
        latestItemsRef.current = trip.items; 

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
        const handleMouseMove = (e: MouseEvent) => {
            if (!dragState.itemId || !dragState.action) return;

            const deltaY = e.clientY - dragStartPosRef.current;
            const deltaDays = deltaY / pixelsPerDay;

            if (!isDraggingRef.current) {
                if (Math.abs(deltaY) < 5) return;
                isDraggingRef.current = true;
                setDragState(prev => ({ ...prev, isDragging: true }));
                setOptimisticItems(trip.items); 
            }

            const currentItemIndex = trip.items.findIndex(i => i.id === dragState.itemId);
            if (currentItemIndex === -1) return;

            const currentItem = trip.items[currentItemIndex];
            const newItems = [...trip.items]; 

            const isTravel = currentItem.type === 'travel' || currentItem.type === 'travel-empty';
            const snap = isTravel ? 0.05 : 0.25; 
            const snappedDelta = Math.round(deltaDays / snap) * snap;

            if (Math.abs(snappedDelta) === 0) return;

            if (dragState.action === 'move') {
                let newStart = dragState.originalOffset + snappedDelta;
                if (newStart < 0) newStart = 0;
                newItems[currentItemIndex] = { ...currentItem, startDateOffset: newStart };
                
                setOptimisticItems(newItems);
                latestItemsRef.current = newItems;
            } 
            else if (dragState.action === 'resize-right') { 
                const newDuration = Math.max(isTravel ? 0.05 : 0.25, dragState.originalDuration + snappedDelta);
                
                if (currentItem.type === 'city') {
                    const diff = newDuration - currentItem.duration;
                    newItems[currentItemIndex] = { ...currentItem, duration: newDuration };
                    
                    const oldEnd = dragState.originalOffset + dragState.originalDuration;
                    newItems.forEach((item, idx) => {
                        if (item.id !== currentItem.id && item.startDateOffset > (oldEnd - 0.05)) {
                            item.startDateOffset += diff; 
                        }
                    });
                } else {
                    newItems[currentItemIndex] = { ...currentItem, duration: newDuration };
                }
                
                setOptimisticItems(newItems);
                latestItemsRef.current = newItems;
            } 
            else if (dragState.action === 'resize-left') { 
                let newStart = dragState.originalOffset + snappedDelta;
                let newDuration = dragState.originalDuration - snappedDelta;

                if (newDuration < (isTravel ? 0.05 : 0.25)) {
                    newDuration = isTravel ? 0.05 : 0.25;
                    newStart = dragState.originalOffset + dragState.originalDuration - newDuration;
                }
                if (newStart < 0) newStart = 0;

                newItems[currentItemIndex] = { ...currentItem, startDateOffset: newStart, duration: newDuration };
                
                setOptimisticItems(newItems);
                latestItemsRef.current = newItems;
            }
        };

        const handleMouseUp = () => {
            if (isDraggingRef.current && latestItemsRef.current !== trip.items) {
                onUpdateItems(latestItemsRef.current);
            }

            isDraggingRef.current = false;
            setOptimisticItems(null); 
            
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


    const cities = itemsToRender.filter(i => i.type === 'city').sort((a, b) => a.startDateOffset - b.startDateOffset);
    const travelItems = itemsToRender.filter(i => i.type === 'travel' || i.type === 'travel-empty').sort((a, b) => a.startDateOffset - b.startDateOffset);
    const activities = itemsToRender.filter(i => i.type === 'activity');

    return (
        <div 
            className="w-full h-full overflow-y-auto bg-white relative no-scrollbar" 
            onClick={() => !isDraggingRef.current && onSelect(null)}
            ref={containerRef}
        >
            <div className="relative flex min-w-[350px]" style={{ height: `${totalHeight + 150}px` }}>
                
                {/* 1. Date Column (Sticky Left) */}
                <div className="w-16 sm:w-20 flex-shrink-0 border-r border-gray-100 bg-white z-30 sticky left-0 h-full select-none group/dates">
                    {Array.from({ length: Math.ceil(tripLength) }).map((_, i) => {
                         const date = addDays(new Date(trip.startDate), i);
                         const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                         return (
                            <div 
                                key={i}
                                className={`absolute left-0 right-0 border-b border-gray-50 flex flex-col items-center justify-start pt-2 group/day
                                    ${isWeekend ? 'bg-gray-50/50' : ''}
                                `}
                                style={{ top: i * pixelsPerDay, height: pixelsPerDay }}
                            >
                                <span className={`text-[10px] font-bold uppercase ${isWeekend ? 'text-red-400' : 'text-gray-400'}`}>
                                    {date.toLocaleDateString('en-US', { weekday: 'short' })}
                                </span>
                                <span className="text-xs font-bold text-gray-700">
                                    {date.getDate()} 
                                </span>
                                <span className="text-[10px] text-gray-400">
                                    {date.toLocaleDateString('en-US', { month: 'short' })}
                                </span>
                            </div>
                         );
                    })}
                </div>

                {/* 2. Grid Lines (Background) */}
                <div className="absolute top-0 bottom-0 left-20 right-0 z-0 pointer-events-none">
                     {Array.from({ length: Math.ceil(tripLength) }).map((_, i) => (
                        <div 
                            key={i}
                            className="absolute left-0 right-0 border-b border-dashed border-gray-100"
                            style={{ top: i * pixelsPerDay, height: pixelsPerDay }}
                        />
                     ))}
                </div>

                {/* 3. Lanes Container */}
                <div className="flex-1 flex relative z-10 pl-2 pr-4 pt-0">

                    {/* Lane A: City (Continuous Line) */}
                    <div className="w-10 sm:w-14 mr-2 relative flex-shrink-0 z-10 group/cities">
                        {/* Connecting Line */}
                        <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-0.5 bg-gray-200 z-0"></div>
                        
                        {cities.map(city => (
                            <div
                                key={city.id}
                                onMouseDown={(e) => handleMoveStart(e, city.id)}
                                onClick={(e) => handleSelect(e, city.id)}
                                className={`absolute left-0 right-0 rounded-lg shadow-sm border cursor-grab active:cursor-grabbing flex flex-col items-center justify-center z-10 transition-colors group timeline-item
                                    ${city.color} 
                                    ${selectedItemId === city.id ? 'ring-2 ring-indigo-500 ring-offset-2 z-20' : ''}
                                `}
                                style={{
                                    top: getTop(city.startDateOffset),
                                    height: getHeight(city.duration)
                                }}
                            >
                                <span className="text-[10px] font-bold rotate-[-90deg] whitespace-nowrap select-none">
                                    {city.title.substring(0, 10)}
                                </span>

                                {/* Resize Handles */}
                                {selectedItemId === city.id && (
                                    <>
                                        <div 
                                            className="absolute -top-3 left-0 right-0 h-6 cursor-row-resize flex items-center justify-center z-50"
                                            onMouseDown={(e) => handleResizeStart(e, city.id, 'top')}
                                        >
                                            <div className="w-8 h-1 bg-white border border-gray-200 rounded-full shadow-sm"></div>
                                        </div>
                                        <div 
                                            className="absolute -bottom-3 left-0 right-0 h-6 cursor-row-resize flex items-center justify-center z-50"
                                            onMouseDown={(e) => handleResizeStart(e, city.id, 'bottom')}
                                        >
                                            <div className="w-8 h-1 bg-white border border-gray-200 rounded-full shadow-sm"></div>
                                        </div>
                                    </>
                                )}
                            </div>
                        ))}

                        {/* Add City Button (Bottom of list) */}
                        <div 
                            className="absolute left-0 right-0 flex justify-center z-20"
                            style={{ top: getTop(tripLength) + 10 }}
                        >
                            <button
                                onClick={(e) => { e.stopPropagation(); onAddCity(); }}
                                className="w-8 h-8 bg-white border border-gray-200 shadow-sm rounded-full flex items-center justify-center text-gray-400 hover:text-indigo-600 hover:border-indigo-200 transition-colors"
                                title="Add City"
                            >
                                <Plus size={16} />
                            </button>
                        </div>
                    </div>
                    
                    {/* Lane B: Travel (Dedicated Column) */}
                    <div 
                        className="w-10 sm:w-14 mr-4 relative flex-shrink-0 z-20 group/travel"
                        ref={travelLaneRef}
                        onMouseMove={handleTravelMouseMove}
                        onMouseLeave={() => setHoverTravelStart(null)}
                        onClick={() => handleGhostClick('travel')}
                    >
                         {/* Ghost Travel Block */}
                         {hoverTravelStart !== null && (
                             <div 
                                 className="absolute left-0 right-0 rounded-lg border-2 border-dashed border-stone-300 bg-stone-100/50 flex items-center justify-center z-0 pointer-events-none"
                                 style={{
                                     top: getTop(hoverTravelStart),
                                     height: getHeight(0.2), // ~5h visual for ghost
                                 }}
                             >
                                 <Plus size={14} className="text-stone-400" />
                             </div>
                         )}

                         {travelItems.map(item => (
                             <div
                                key={item.id}
                                onClick={(e) => handleSelect(e, item.id)}
                                onMouseDown={(e) => handleMoveStart(e, item.id)}
                                className={`absolute left-0 right-0 rounded-lg border cursor-grab active:cursor-grabbing flex items-center justify-center z-20 transition-all hover:scale-105 hover:shadow-md hover:brightness-110 group timeline-item
                                    ${item.color}
                                    ${selectedItemId === item.id ? 'ring-2 ring-indigo-500 ring-offset-2 z-30' : ''}
                                `}
                                style={{
                                    top: getTop(item.startDateOffset),
                                    height: getHeight(item.duration),
                                }}
                                title={item.title}
                            >
                                <TransportIcon mode={item.transportMode} className="w-5 h-5 text-stone-100" />

                                {/* Resize Handles */}
                                {selectedItemId === item.id && (
                                    <>
                                        <div 
                                            className="absolute -top-2 left-0 right-0 h-4 cursor-row-resize flex justify-center items-center z-50"
                                            onMouseDown={(e) => handleResizeStart(e, item.id, 'top')}
                                        />
                                        <div 
                                            className="absolute -bottom-2 left-0 right-0 h-4 cursor-row-resize flex justify-center items-center z-50"
                                            onMouseDown={(e) => handleResizeStart(e, item.id, 'bottom')}
                                        />
                                    </>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Lane C: Activities (Mixed) */}
                    <div 
                        className="flex-1 relative z-10"
                        ref={activityLaneRef}
                        onMouseMove={handleActivityMouseMove}
                        onMouseLeave={() => setHoverActivityStart(null)}
                        onClick={() => handleGhostClick('activity')}
                    >
                        {/* Ghost Activity Block */}
                        {hoverActivityStart !== null && (
                             <div 
                                 className="absolute left-0 max-w-[200px] w-full rounded-lg border-2 border-dashed border-indigo-200 bg-indigo-50/50 flex flex-col items-center justify-center z-0 pointer-events-none"
                                 style={{
                                     top: getTop(hoverActivityStart),
                                     height: getHeight(0.25) // Short default for ghost
                                 }}
                             >
                                 <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1">
                                     <Plus size={10} /> Add Activity
                                 </span>
                             </div>
                        )}

                        {activities.map(act => (
                            <div
                                key={act.id}
                                onClick={(e) => handleSelect(e, act.id)}
                                onMouseDown={(e) => handleMoveStart(e, act.id)}
                                className={`absolute left-0 max-w-[200px] w-full rounded-lg px-2 py-1 border text-xs shadow-sm cursor-grab active:cursor-grabbing transition-all hover:translate-x-1 group overflow-hidden timeline-item flex flex-col items-center justify-center text-center
                                    ${act.color}
                                    ${selectedItemId === act.id ? 'ring-2 ring-indigo-500 ring-offset-2 z-20' : 'z-10'}
                                `}
                                style={{
                                    top: getTop(act.startDateOffset),
                                    height: getHeight(act.duration),
                                }}
                            >
                                <div className="mb-0.5 opacity-70">
                                    <ActivityIcon type={Array.isArray(act.activityType) ? act.activityType[0] : act.activityType} />
                                </div>
                                <div className="font-bold truncate select-none w-full leading-tight">{act.title}</div>
                                
                                {/* Simple Top/Bottom Resizers for Activities if selected */}
                                {selectedItemId === act.id && (
                                    <>
                                        <div 
                                            className="absolute -top-1.5 left-0 right-0 h-3 cursor-row-resize flex justify-center hover:bg-black/5 rounded-t-lg z-50"
                                            onMouseDown={(e) => handleResizeStart(e, act.id, 'top')}
                                        />
                                        <div 
                                            className="absolute -bottom-1.5 left-0 right-0 h-3 cursor-row-resize flex justify-center hover:bg-black/5 rounded-b-lg z-50"
                                            onMouseDown={(e) => handleResizeStart(e, act.id, 'bottom')}
                                        />
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};