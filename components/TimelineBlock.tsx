import React, { useRef } from 'react';
import { ITimelineItem, ActivityType } from '../types';
import { getActivityColorByTypes, getContrastTextColor, getHexFromColorClass, isTailwindCityColorValue, pickPrimaryActivityType, shiftHexColor } from '../utils';
import { Maximize, Minimize, ArrowLeftRight, ArrowUpDown } from 'lucide-react';
import { ActivityTypeIcon } from './ActivityTypeVisuals';
import { TransportModeIcon } from './TransportModeIcon';
import { normalizeTransportMode } from '../shared/transportModes';

interface TimelineBlockProps {
  item: ITimelineItem;
  isSelected: boolean;
  onSelect: (id: string, options?: { multi?: boolean; isCity?: boolean }) => void;
  onResizeStart: (e: React.MouseEvent | React.PointerEvent, id: string, direction: 'left' | 'right') => void;
  onMoveStart: (e: React.MouseEvent | React.PointerEvent, id: string) => void;
  onForceFill?: (id: string) => void;
  onSwapSelectedCities?: () => void;
  isCity?: boolean;
  hasGapOrOverlap?: boolean;
  forceFillMode?: 'stretch' | 'shrink';
  forceFillLabel?: string;
  showSwapSelectedButton?: boolean;
  swapSelectedLabel?: string;
  pixelsPerDay: number;
  timelineStartOffset?: number;
  vertical?: boolean;
  canEdit?: boolean;
}

export const TimelineBlock: React.FC<TimelineBlockProps> = ({
  item,
  isSelected,
  onSelect,
  onResizeStart,
  onMoveStart,
  onForceFill,
  onSwapSelectedCities,
  isCity = false,
  hasGapOrOverlap = false,
  forceFillMode,
  forceFillLabel,
  showSwapSelectedButton = false,
  swapSelectedLabel,
  pixelsPerDay,
  timelineStartOffset = 0,
  vertical = false,
  canEdit = true,
}) => {
  const isTravel = item.type === 'travel';
  const isEmptyTravel = item.type === 'travel-empty';
  const normalizedTransportMode = isTravel ? normalizeTransportMode(item.transportMode) : 'na';
  const isUnsetTravelMode = isTravel && normalizedTransportMode === 'na';
  const isLoadingItem = !!item.loading;
  
  // Drag detection refs
  const dragStartPos = useRef<{x: number, y: number} | null>(null);
  
  // Visual Dimensions
  const dimensionCheck = item.duration * pixelsPerDay;
  const size = Math.max(dimensionCheck, (isTravel || isEmptyTravel) ? 40 : 20); 
  const position = (item.startDateOffset - timelineStartOffset) * pixelsPerDay;

  // Buffer calculations (Minutes -> Days -> Pixels)
  const bufferBeforePx = item.bufferBefore ? (item.bufferBefore / 1440) * pixelsPerDay : 0;
  const bufferAfterPx = item.bufferAfter ? (item.bufferAfter / 1440) * pixelsPerDay : 0;

  // Handle Legacy or Array Activity Type
  const primaryActivityType = item.type === 'activity'
    ? pickPrimaryActivityType(item.activityType)
    : undefined;
  const cityUsesClassColor = item.type === 'city' && isTailwindCityColorValue(item.color);
  const resolvedColorClass =
    item.type === 'activity'
      ? getActivityColorByTypes(item.activityType)
      : item.type === 'city'
        ? (cityUsesClassColor ? item.color : 'border')
        : item.color;
  const cityHex = item.type === 'city'
      ? getHexFromColorClass(item.color || '')
      : null;
  const isCompactVerticalActivity = vertical && item.type === 'activity' && size >= 20 && size < 40;
  const compactVerticalTitleSize = Math.max(9, Math.min(11, size * 0.28));

  const handlePointerDown = (e: React.PointerEvent) => {
      if (!canEdit) return;
      e.stopPropagation(); // Prevent ghost creation on parent
      if (isCity && (e.shiftKey || e.metaKey || e.ctrlKey)) return;
      dragStartPos.current = { x: e.clientX, y: e.clientY };
      // Initiate move immediately
      onMoveStart(e, item.id);
  };

  const handleClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      onSelect(item.id, { multi: isCity && (e.shiftKey || e.metaKey || e.ctrlKey), isCity });
  };

  const baseCursor = canEdit
      ? (isCity ? 'pointer' : (isEmptyTravel ? 'pointer' : 'grab'))
      : (isEmptyTravel ? 'not-allowed' : 'pointer');

  const style: React.CSSProperties = vertical ? {
      top: `${position}px`,
      height: `${size}px`,
      left: 0,
      right: 0,
      cursor: baseCursor,
      touchAction: canEdit ? 'none' : undefined,
  } : {
      left: `${position}px`,
      width: `${size}px`,
      cursor: baseCursor,
      touchAction: canEdit ? 'none' : undefined,
  };
  const mergedStyle: React.CSSProperties = cityHex
      ? {
          ...style,
          backgroundColor: cityHex,
          borderColor: shiftHexColor(cityHex, -20),
          color: getContrastTextColor(cityHex),
      }
      : style;

  return (
    <div
      className={`absolute transition-all group flex flex-col justify-center select-none timeline-block-item
        ${isLoadingItem ? 'bg-slate-100 border-slate-200 text-slate-400 animate-pulse' : resolvedColorClass}
        ${isCity ? 'opacity-80 rounded-sm border cursor-pointer' : 'rounded-lg border shadow-sm'} 
        ${!vertical && isCity ? 'top-0 bottom-0' : ''}
        ${isSelected ? 'ring-2 ring-offset-1 ring-accent-500 z-30 opacity-100' : 'z-10'}
        ${(isTravel || isEmptyTravel) ? 'z-20' : 'overflow-hidden'}
        ${isUnsetTravelMode ? 'border-dashed border-slate-200 bg-slate-50/70 text-slate-500' : ''}
        ${isEmptyTravel ? (canEdit ? 'border-dashed cursor-pointer hover:bg-gray-50' : 'border-dashed cursor-not-allowed opacity-70') : ''}
      `}
      style={mergedStyle}
      onPointerDown={handlePointerDown}
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
      <div className={`flex items-center px-1 relative h-full w-full pointer-events-none overflow-hidden
          ${vertical 
             ? (
                isCompactVerticalActivity
                  ? 'justify-center text-center'
                  : (size < 40 ? 'hidden' : size < 60 ? 'flex-row justify-center gap-1.5' : 'flex-col justify-center text-center py-1')
               )
             : 'justify-center flex-col text-center'}
      `}>
        
        {isTravel && (
            <div className={`flex items-center gap-1 ${vertical && item.duration * pixelsPerDay >= 60 ? 'mb-1' : ''}`}>
                {!isUnsetTravelMode && (
                    <TransportModeIcon mode={normalizedTransportMode} size={16} className="flex-shrink-0" />
                )}
            </div>
        )}

        {isEmptyTravel && (
            <span className="text-[10px] font-medium text-gray-400 select-none">Add</span>
        )}

        {!isTravel && !isEmptyTravel && item.type === 'activity' && !isCompactVerticalActivity && (
             <ActivityTypeIcon type={primaryActivityType || 'general'} size={14} className={`opacity-70 ${vertical && item.duration * pixelsPerDay >= 60 ? 'mb-1' : ''}`} />
        )}

        {!isEmptyTravel && (
            <span
                className={`font-semibold select-none leading-tight 
                    ${isCompactVerticalActivity
                        ? 'w-full truncate whitespace-nowrap text-center'
                        : `${isTravel ? 'text-xs w-full whitespace-normal line-clamp-2' : 'text-sm whitespace-normal'}
                           ${!isTravel && 'line-clamp-2'}
                           ${vertical 
                               ? (item.duration * pixelsPerDay < 60 ? 'truncate whitespace-nowrap' : 'w-full break-words') 
                               : 'truncate'}`
                    }
                `}
                style={isCompactVerticalActivity ? { fontSize: `${compactVerticalTitleSize}px` } : undefined}
            >
                {isLoadingItem ? 'Loading city...' : item.title}
                {isUnsetTravelMode && (
                    <span className="block text-[9px] opacity-85 font-semibold mt-0.5">
                        N/A
                    </span>
                )}
                {isTravel && item.departureTime && (
                    <span className="block text-[9px] opacity-75 font-normal mt-0.5">
                        {item.departureTime}
                    </span>
                )}
            </span>
        )}

        {/* Duration Display */}
        {!isTravel && !isEmptyTravel && (
            <span className={`text-[10px] opacity-80 select-none 
                ${vertical 
                    ? (item.duration * pixelsPerDay < 60 ? 'hidden' : 'mt-0.5 block')
                    : 'hidden sm:block'}
            `}>
                {isCity 
                    ? `${Number(item.duration.toFixed(1))} Nights` 
                    : (item.duration * pixelsPerDay > 30 ? (item.duration === 1 ? '1D' : `${Number(item.duration.toFixed(1))}D`) : '') 
                }
            </span>
        )}
      </div>
      
      {/* Duration Display (Activities - Horizontal Backup) */}
      {!vertical && !isTravel && !isEmptyTravel && !isCity && item.duration * pixelsPerDay > 50 && (
        <span className="sm:hidden text-[10px] opacity-70 truncate select-none px-3 pb-1 w-full text-center">
             {item.duration === 1 ? '1 Day' : `${Number(item.duration.toFixed(1))} Days`}
        </span>
      )}
      
      {/* City quick actions */}
      {isCity && !isLoadingItem && ((onForceFill && (forceFillMode || hasGapOrOverlap)) || (onSwapSelectedCities && showSwapSelectedButton)) && (
          <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-auto flex items-center gap-1">
             {onSwapSelectedCities && showSwapSelectedButton && (
                <button
                    onClick={(e) => { e.stopPropagation(); if (!canEdit) return; onSwapSelectedCities(); }}
                    disabled={!canEdit}
                    className={`bg-white text-accent-600 shadow-md border border-gray-200 p-1 rounded-full transition-transform ${canEdit ? 'hover:bg-accent-50 hover:scale-110' : 'cursor-not-allowed opacity-60'}`}
                    title={swapSelectedLabel || 'Reverse selected cities'}
                >
                    {vertical ? <ArrowUpDown size={12} strokeWidth={3} /> : <ArrowLeftRight size={12} strokeWidth={3} />}
                </button>
             )}
             {onForceFill && (forceFillMode || hasGapOrOverlap) && (
                <button 
                    onClick={(e) => { e.stopPropagation(); if (!canEdit) return; onForceFill(item.id); }}
                    disabled={!canEdit}
                    className={`bg-white text-accent-600 shadow-md border border-gray-200 p-1 rounded-full transition-transform ${canEdit ? 'hover:bg-accent-50 hover:scale-110' : 'cursor-not-allowed opacity-60'}`}
                    title={forceFillLabel || 'Occupy available space'}
                >
                    {(forceFillMode === 'shrink') ? <Minimize size={12} strokeWidth={3} /> : <Maximize size={12} strokeWidth={3} />}
                </button>
             )}
          </div>
      )}

      {/* Resize Handle (Start/Top/Left) - City Only */}
      {isCity && !isLoadingItem && (
        <div
            className={`absolute z-40 pointer-events-auto flex items-center justify-center group/handle
                ${vertical 
                    ? `top-0 left-0 right-0 h-4 ${canEdit ? 'cursor-row-resize' : 'cursor-not-allowed'}` 
                    : `-left-1 top-0 bottom-0 w-6 ${canEdit ? 'cursor-col-resize' : 'cursor-not-allowed'}`
                }
                ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}
            `}
            onPointerDown={(e) => { e.preventDefault(); if (e.pointerType === 'touch') e.stopPropagation(); if (!canEdit) return; onResizeStart(e, item.id, 'left'); }}
        >
            <div className={`rounded-full transition-colors shadow-sm flex items-center justify-center
                ${vertical ? 'w-8 h-1.5' : 'h-8 w-1.5'}
                ${isSelected ? 'bg-white border border-gray-300' : 'bg-white/80 border border-gray-200 group-hover/handle:bg-accent-500 group-hover/handle:border-accent-600'}
            `}>
               <div className={`flex gap-[2px] opacity-50 ${vertical ? 'flex-row' : 'flex-col'}`}>
                 <div className="w-0.5 h-0.5 bg-current rounded-full"></div>
                 <div className="w-0.5 h-0.5 bg-current rounded-full"></div>
                 <div className="w-0.5 h-0.5 bg-current rounded-full"></div>
               </div>
            </div>
        </div>
      )}

      {/* Resize Handle (End/Bottom/Right) - City Only */}
      {isCity && !isLoadingItem && (
        <div
            className={`absolute z-40 pointer-events-auto flex items-center justify-center group/handle
                ${vertical 
                    ? `bottom-0 left-0 right-0 h-4 ${canEdit ? 'cursor-row-resize' : 'cursor-not-allowed'}` 
                    : `-right-1 top-0 bottom-0 w-6 ${canEdit ? 'cursor-col-resize' : 'cursor-not-allowed'}`
                }
                ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}
            `}
            onPointerDown={(e) => { e.preventDefault(); if (e.pointerType === 'touch') e.stopPropagation(); if (!canEdit) return; onResizeStart(e, item.id, 'right'); }}
        >
            <div className={`rounded-full transition-colors shadow-sm flex items-center justify-center
                ${vertical ? 'w-8 h-1.5' : 'h-8 w-1.5'}
                ${isSelected ? 'bg-white border border-gray-300' : 'bg-white/80 border border-gray-200 group-hover/handle:bg-accent-500 group-hover/handle:border-accent-600'}
            `}>
               <div className={`flex gap-[2px] opacity-50 ${vertical ? 'flex-row' : 'flex-col'}`}>
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
