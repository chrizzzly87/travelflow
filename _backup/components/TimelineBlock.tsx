import React, { useRef } from 'react';
import { ITimelineItem, ActivityType } from '../types';
import { Plane, Train, Bus, Ship, Car, Utensils, Camera, Coffee, Landmark, Music, Map, Maximize, Dumbbell, Mountain, PawPrint, ShoppingBag, Compass, Palmtree, Leaf } from 'lucide-react';

interface TimelineBlockProps {
  item: ITimelineItem;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onResizeStart: (e: React.MouseEvent, id: string, direction: 'left' | 'right') => void;
  onMoveStart: (e: React.MouseEvent, id: string) => void;
  onForceFill?: (id: string) => void;
  isCity?: boolean;
  hasGapOrOverlap?: boolean;
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

const ActivityIcon = ({ type, className }: { type?: ActivityType, className?: string }) => {
    switch(type) {
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
        default: return <Map size={14} className={className} />;
    }
}

export const TimelineBlock: React.FC<TimelineBlockProps> = ({
  item,
  isSelected,
  onSelect,
  onResizeStart,
  onMoveStart,
  onForceFill,
  isCity = false,
  hasGapOrOverlap = false,
  pixelsPerDay,
}) => {
  const isTravel = item.type === 'travel';
  const isEmptyTravel = item.type === 'travel-empty';
  
  // Drag detection refs
  const dragStartPos = useRef<{x: number, y: number} | null>(null);
  
  // Visual width calculation
  const width = Math.max(item.duration * pixelsPerDay, (isTravel || isEmptyTravel) ? 40 : 20); 
  const left = item.startDateOffset * pixelsPerDay;

  // Buffer calculations (Minutes -> Days -> Pixels)
  const bufferBeforePx = item.bufferBefore ? (item.bufferBefore / 1440) * pixelsPerDay : 0;
  const bufferAfterPx = item.bufferAfter ? (item.bufferAfter / 1440) * pixelsPerDay : 0;

  // Handle Legacy or Array Activity Type
  const primaryActivityType = Array.isArray(item.activityType) 
    ? item.activityType[0] 
    : (item.activityType as ActivityType | undefined);

  const handleMouseDown = (e: React.MouseEvent) => {
      e.stopPropagation(); // Prevent ghost creation on parent
      dragStartPos.current = { x: e.clientX, y: e.clientY };
      // Initiate move immediately
      onMoveStart(e, item.id);
  };

  const handleClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      onSelect(item.id);
  };

  return (
    <div
      className={`absolute transition-all group flex flex-col justify-center select-none timeline-block-item
        ${item.color}
        ${isCity ? 'opacity-100 top-0 bottom-0 rounded-sm border-r border-white/20' : 'top-1 bottom-1 rounded-lg border shadow-sm'} 
        ${isSelected ? 'ring-2 ring-offset-1 ring-blue-500 z-30 opacity-100' : 'z-10'}
        ${(isTravel || isEmptyTravel) ? 'z-20' : 'overflow-hidden'}
        ${isEmptyTravel ? 'border-dashed cursor-pointer hover:bg-gray-50' : ''}
      `}
      style={{
        left: `${left}px`,
        width: `${width}px`,
        cursor: isCity ? 'default' : 'grab',
      }}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
    >
      {/* Visual Buffers (Travel Only) */}
      {isTravel && (
        <>
            {bufferBeforePx > 0 && (
                <div 
                    className="absolute top-1/2 -translate-y-1/2 h-[80%] border-t-2 border-b-2 border-l-2 border-gray-300 border-dashed rounded-l-lg bg-gray-100/40 pointer-events-none"
                    style={{ right: '100%', width: `${bufferBeforePx}px` }}
                    title={`Buffer before: ${item.bufferBefore}m`}
                >
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-full text-[8px] text-gray-400 text-center font-bold overflow-hidden">
                        {item.bufferBefore}m
                    </div>
                </div>
            )}
            {bufferAfterPx > 0 && (
                <div 
                    className="absolute top-1/2 -translate-y-1/2 h-[80%] border-t-2 border-b-2 border-r-2 border-gray-300 border-dashed rounded-r-lg bg-gray-100/40 pointer-events-none"
                    style={{ left: '100%', width: `${bufferAfterPx}px` }}
                    title={`Buffer after: ${item.bufferAfter}m`}
                >
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full text-[8px] text-gray-400 text-center font-bold overflow-hidden">
                        {item.bufferAfter}m
                    </div>
                </div>
            )}
        </>
      )}

      {/* Main Content Container */}
      <div className={`flex items-center px-2 relative h-full w-full pointer-events-none
          ${(isTravel || isEmptyTravel) ? 'justify-center flex-col text-center p-1' : 'flex-col justify-center text-center'}
      `}>
        
        {isTravel && (
            <div className="flex items-center gap-1 mb-0.5">
                <TransportIcon mode={item.transportMode} className="flex-shrink-0" />
            </div>
        )}

        {isEmptyTravel && (
            <span className="text-[10px] font-medium text-gray-400 select-none">Add Travel</span>
        )}

        {!isTravel && !isEmptyTravel && item.type === 'activity' && (
             <ActivityIcon type={primaryActivityType} className="mb-0.5 opacity-70" />
        )}

        {!isEmptyTravel && (
            <span className={`font-semibold select-none leading-tight 
                ${isTravel ? 'text-xs w-full whitespace-normal line-clamp-2' : 'text-sm whitespace-normal'}
                ${!isTravel && 'line-clamp-2'}
            `}>
                {item.title}
                {isTravel && item.departureTime && (
                    <span className="block text-[9px] opacity-75 font-normal mt-0.5">
                        {item.departureTime}
                    </span>
                )}
            </span>
        )}

        {/* Duration Display (Moved Inside for Cities) */}
        {!isTravel && !isEmptyTravel && isCity && (
            <span className="text-[10px] opacity-80 truncate select-none mt-0.5 block">
                {Number(item.duration.toFixed(1))} Nights
            </span>
        )}
      </div>
      
      {/* Duration Display (Activities - Outside/Bottom if room?) -> Currently bottom of card */}
      {!isTravel && !isEmptyTravel && !isCity && item.duration * pixelsPerDay > 50 && (
        <span className="text-[10px] opacity-70 truncate select-none px-3 pb-1 w-full text-center">
             {item.duration === 1 ? '1 Day' : `${Number(item.duration.toFixed(1))} Days`}
        </span>
      )}
      
      {/* City "Snap to Fill" Button on Hover */}
      {isCity && onForceFill && hasGapOrOverlap && (
          <div className="absolute -top-3 right-0 opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-auto">
             <button 
                onClick={(e) => { e.stopPropagation(); onForceFill(item.id); }}
                className="bg-white text-indigo-600 shadow-md border border-gray-200 p-1 rounded-full hover:bg-indigo-50 hover:scale-110 transition-transform"
                title="Fill Gap / Fix Overlap"
            >
                 <Maximize size={12} strokeWidth={3} />
             </button>
          </div>
      )}

      {/* Resize Handle (Left Side) - City Only */}
      {isCity && (
        <div
            className={`absolute -left-1 top-0 bottom-0 w-6 cursor-col-resize flex items-center justify-center group/handle transition-all z-20 pointer-events-auto
                ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}
            `}
            onMouseDown={(e) => onResizeStart(e, item.id, 'left')}
        >
            <div className={`h-8 w-1.5 rounded-full transition-colors shadow-sm
                ${isSelected ? 'bg-white border border-gray-300' : 'bg-white/80 border border-gray-200 group-hover/handle:bg-indigo-500 group-hover/handle:border-indigo-600'}
            `}>
               <div className="h-full w-full flex flex-col justify-center items-center gap-[1px] opacity-50">
                 <div className="w-0.5 h-0.5 bg-current rounded-full"></div>
                 <div className="w-0.5 h-0.5 bg-current rounded-full"></div>
                 <div className="w-0.5 h-0.5 bg-current rounded-full"></div>
               </div>
            </div>
        </div>
      )}

      {/* Resize Handle (Right Side) - City Only */}
      {isCity && (
        <div
            className={`absolute -right-1 top-0 bottom-0 w-6 cursor-col-resize flex items-center justify-center group/handle transition-all z-20 pointer-events-auto
                 ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}
            `}
            onMouseDown={(e) => onResizeStart(e, item.id, 'right')}
        >
            <div className={`h-8 w-1.5 rounded-full transition-colors shadow-sm
                ${isSelected ? 'bg-white border border-gray-300' : 'bg-white/80 border border-gray-200 group-hover/handle:bg-indigo-500 group-hover/handle:border-indigo-600'}
            `}>
               <div className="h-full w-full flex flex-col justify-center items-center gap-[1px] opacity-50">
                 <div className="w-0.5 h-0.5 bg-current rounded-full"></div>
                 <div className="w-0.5 h-0.5 bg-current rounded-full"></div>
                 <div className="w-0.5 h-0.5 bg-current rounded-full"></div>
               </div>
            </div>
        </div>
      )}
    </div>
  );
};