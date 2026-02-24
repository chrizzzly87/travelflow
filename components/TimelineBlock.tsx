import React, { useRef } from 'react';
import { ITimelineItem } from '../types';
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
  viewTransitionName?: string;
  cityStackIndex?: number;
  cityStackCount?: number;
  cityVisualColorHex?: string;
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
  viewTransitionName,
  cityStackIndex = 0,
  cityStackCount = 1,
  cityVisualColorHex,
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
  const cityPlanStatus = item.type === 'city' ? (item.cityPlanStatus || 'confirmed') : 'confirmed';
  const isUncertainCity = item.type === 'city' && cityPlanStatus === 'uncertain';
  const cityPlanOptionIndex = isUncertainCity
    ? Math.max(0, Math.floor(item.cityPlanOptionIndex || 0))
    : 0;
  const normalizedCityStackCount = isCity ? Math.max(1, Math.floor(cityStackCount)) : 1;
  const normalizedCityStackIndex = isCity
    ? Math.min(normalizedCityStackCount - 1, Math.max(0, Math.floor(cityStackIndex)))
    : 0;
  const resolvedColorClass =
    item.type === 'activity'
      ? getActivityColorByTypes(item.activityType)
      : item.type === 'city'
        ? (cityUsesClassColor ? item.color : 'border')
        : item.color;
  const cityHex = item.type === 'city'
      ? (cityVisualColorHex || getHexFromColorClass(item.color || ''))
      : null;
  const isCompactVerticalActivity = vertical && item.type === 'activity' && size >= 20 && size < 40;
  const compactVerticalTitleSize = Math.max(9, Math.min(11, size * 0.28));
  const cityDayCount = isCity ? Math.max(1, Math.ceil(item.duration - 0.01)) : 0;
  const cityNightCount = isCity ? Math.max(0, cityDayCount - 1) : 0;
  const cityDurationFullLabel = `${cityDayCount} ${cityDayCount === 1 ? 'Day' : 'Days'} / ${cityNightCount} ${cityNightCount === 1 ? 'Night' : 'Nights'}`;
  const fallbackCountryFromLocation = item.location
    ? (() => {
        const parts = item.location.split(',').map(part => part.trim()).filter(Boolean);
        return parts.length > 0 ? parts[parts.length - 1] : undefined;
      })()
    : undefined;
  const cityCountry = item.countryName || fallbackCountryFromLocation;
  const cityTooltipTitle = isCity && cityCountry && !item.title.toLowerCase().includes(cityCountry.toLowerCase())
    ? `${item.title}, ${cityCountry}`
    : item.title;
  const cityTooltipText = isCity && !vertical && !isLoadingItem
    ? `${cityTooltipTitle} • ${cityDurationFullLabel}`
    : undefined;
  const shouldRotateVerticalCityLabel = isCity && vertical && normalizedCityStackCount > 1;

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

  const cityInlineGapPx = isCity ? 2 : 0;
  const cityVerticalGapPx = isCity ? 8 : 0;
  const cityInsetPx = isCity ? 2 : 0;
  const cityStackGapPx = 2;
  const citySlotHeightExpr = 'var(--tf-city-slot-height, 3.25rem)';
  const style: React.CSSProperties = vertical
      ? {
          top: `${position + (cityVerticalGapPx / 2)}px`,
          height: `${Math.max(6, size - cityVerticalGapPx)}px`,
          left: 0,
          right: 0,
          cursor: baseCursor,
          touchAction: canEdit ? 'none' : undefined,
      }
      : {
          left: `${position}px`,
          width: `${size}px`,
          cursor: baseCursor,
          touchAction: canEdit ? 'none' : undefined,
      };

  if (isCity && vertical) {
      if (normalizedCityStackCount > 1) {
          const totalInlineGap = (cityInsetPx * 2) + (cityStackGapPx * (normalizedCityStackCount - 1));
          const columnWidthExpr = `calc((100% - ${totalInlineGap}px) / ${normalizedCityStackCount})`;
          style.left = `calc(${cityInsetPx}px + ${normalizedCityStackIndex} * (${columnWidthExpr} + ${cityStackGapPx}px))`;
          style.width = columnWidthExpr;
          style.right = undefined;
      } else {
          style.left = `${cityInsetPx}px`;
          style.right = `${cityInsetPx}px`;
      }
  }

  if (isCity && !vertical) {
      style.left = `${position + (cityInlineGapPx / 2)}px`;
      style.width = `${Math.max(6, size - cityInlineGapPx)}px`;
      style.top = `calc(${cityInsetPx}px + ${normalizedCityStackIndex} * (${citySlotHeightExpr} + ${cityStackGapPx}px))`;
      style.height = citySlotHeightExpr;
  }
  const selectedCityOutline = isCity && isSelected
      ? '0 0 0 3px rgb(37 99 235 / 0.98)'
      : '';
  const isInactiveItem = item.isApproved === false;
  const isInactiveActivity = item.type === 'activity' && isInactiveItem;
  const cityBaseBackgroundHex = cityHex
      ? shiftHexColor(cityHex, isUncertainCity ? 104 : 88)
      : null;
  const cityBorderHex = cityHex ? shiftHexColor(cityHex, -20) : null;
  const activityHex = item.type === 'activity'
      ? getHexFromColorClass(resolvedColorClass || item.color || '')
      : null;
  const inactiveActivityBackgroundHex = activityHex ? shiftHexColor(activityHex, 18) : 'rgb(241 245 249 / 0.92)';
  const inactiveActivityShouldUseWhiteText = activityHex
      ? getContrastTextColor(inactiveActivityBackgroundHex) === '#ffffff'
      : false;
  const inactiveActivityTextHex = activityHex
      ? (inactiveActivityShouldUseWhiteText ? '#ffffff' : shiftHexColor(activityHex, -96))
      : '#334155';
  const inactiveActivityBorderColor = activityHex
      ? (inactiveActivityShouldUseWhiteText ? 'rgb(255 255 255 / 0.54)' : shiftHexColor(activityHex, -54))
      : 'rgb(100 116 139 / 0.62)';
  const inactiveActivityStripeLight = activityHex
      ? `color-mix(in oklab, ${activityHex} 88%, white 12%)`
      : 'rgb(226 232 240 / 0.9)';
  const inactiveActivityStripeDark = activityHex
      ? `color-mix(in oklab, ${activityHex} 80%, black 20%)`
      : 'rgb(203 213 225 / 0.92)';
  const shouldUseWhiteCityText = cityBaseBackgroundHex
      ? getContrastTextColor(cityBaseBackgroundHex) === '#ffffff'
      : true;
  const inactiveCityTextColor = cityHex
      ? (shouldUseWhiteCityText ? 'rgb(255 255 255 / 0.88)' : shiftHexColor(cityHex, -74))
      : 'rgb(255 255 255 / 0.88)';
  const cityTextColor = cityHex
      ? (isInactiveItem
          ? inactiveCityTextColor
          : (shouldUseWhiteCityText ? 'rgb(255 255 255 / 0.98)' : shiftHexColor(cityHex, -96)))
      : 'rgb(255 255 255 / 0.98)';
  const cityInactiveBorderColor = cityHex
      ? (shouldUseWhiteCityText ? 'rgb(255 255 255 / 0.5)' : shiftHexColor(cityHex, -54))
      : 'rgb(255 255 255 / 0.5)';
  const mergedStyle: React.CSSProperties = cityHex && !isLoadingItem
      ? {
          ...style,
          // Fallback color for browsers that do not support color-mix.
          backgroundColor: cityBaseBackgroundHex || undefined,
          backgroundImage: isUncertainCity
            ? `linear-gradient(155deg,
               color-mix(in oklab, ${cityHex} 30%, transparent) 0%,
                 color-mix(in oklab, ${cityHex} 44%, white 56%) 100%
               ),
               repeating-linear-gradient(-45deg,
                 color-mix(in oklab, ${cityHex} 60%, white 40%) 0 7px,
                 color-mix(in oklab, ${cityHex} 52%, white 48%) 7px 14px
               )`
            : `linear-gradient(155deg,
                 color-mix(in oklab, ${cityHex} 42%, white 58%) 0%,
                 color-mix(in oklab, ${cityHex} 60%, white 40%) 100%
               )`,
          backgroundOrigin: isUncertainCity ? 'padding-box, border-box' : undefined,
          backgroundClip: isUncertainCity ? 'padding-box, border-box' : undefined,
          borderColor: isInactiveItem
            ? cityInactiveBorderColor
            : (isUncertainCity ? 'transparent' : (cityBorderHex || undefined)),
          borderStyle: isInactiveItem ? 'dashed' : 'solid',
          borderWidth: isInactiveItem ? 1 : 2,
          color: cityTextColor,
          textShadow: shouldUseWhiteCityText
            ? '0 1px 2px rgb(15 23 42 / 0.32)'
            : '0 1px 0 rgb(255 255 255 / 0.28)',
          boxShadow: [
            selectedCityOutline,
            'inset 0 1px 0 rgb(255 255 255 / 0.32)',
          ].filter(Boolean).join(', '),
          opacity: isInactiveItem ? 0.74 : (isUncertainCity ? 0.86 : 0.96),
      }
      : (isInactiveActivity && !isLoadingItem
          ? {
              ...style,
              // Fallback color for browsers that do not support color-mix.
              backgroundColor: inactiveActivityBackgroundHex,
              backgroundImage: `linear-gradient(155deg,
                    color-mix(in oklab, ${activityHex || '#94a3b8'} 82%, white 18%) 0%,
                    color-mix(in oklab, ${activityHex || '#94a3b8'} 90%, white 10%) 100%
                  ),
                  repeating-linear-gradient(-45deg,
                    ${inactiveActivityStripeDark} 0 8px,
                    ${inactiveActivityStripeLight} 8px 16px
                  )`,
              backgroundOrigin: 'padding-box, padding-box',
              backgroundClip: 'padding-box, padding-box',
              borderColor: inactiveActivityBorderColor,
              borderStyle: 'dashed',
              borderWidth: 1.5,
              color: inactiveActivityShouldUseWhiteText
                  ? 'rgb(255 255 255 / 0.92)'
                  : `color-mix(in oklab, ${inactiveActivityTextHex} 94%, black 6%)`,
              textShadow: inactiveActivityShouldUseWhiteText
                  ? '0 1px 1px rgb(15 23 42 / 0.28)'
                  : '0 1px 0 rgb(255 255 255 / 0.18)',
              boxShadow: 'inset 0 1px 0 rgb(255 255 255 / 0.26)',
              opacity: 0.88,
          }
      : (selectedCityOutline
          ? { ...style, boxShadow: selectedCityOutline }
          : style));
  const finalStyle: React.CSSProperties = viewTransitionName
      ? { ...mergedStyle, viewTransitionName }
      : mergedStyle;

  return (
    <div
      className={`absolute transition-all group flex flex-col justify-center select-none timeline-block-item
        ${isLoadingItem ? 'bg-slate-100 border-slate-200 text-slate-400 animate-pulse' : resolvedColorClass}
        ${isCity ? 'rounded-md border-2 cursor-pointer backdrop-blur-[1px]' : 'rounded-lg border shadow-sm'} 
        ${isSelected ? 'z-30 opacity-100' : 'z-10'}
        ${(isTravel || isEmptyTravel) ? 'z-20' : 'overflow-hidden'}
        ${isInactiveActivity ? 'border-dashed shadow-none' : ''}
        ${isUnsetTravelMode ? 'border-dashed border-slate-200 bg-slate-50/70 text-slate-500' : ''}
        ${isEmptyTravel ? (canEdit ? 'border-dashed cursor-pointer hover:bg-gray-50' : 'border-dashed cursor-not-allowed opacity-70') : ''}
      `}
      style={finalStyle}
      onPointerDown={handlePointerDown}
      onClick={handleClick}
      data-tooltip={cityTooltipText}
      data-city-block={isCity ? 'true' : undefined}
      data-city-stack-index={isCity ? String(normalizedCityStackIndex) : undefined}
      data-city-id={isCity ? item.id : undefined}
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
      <div className={`flex items-center px-1.5 relative h-full w-full pointer-events-none overflow-hidden
          ${vertical 
             ? (
                isCompactVerticalActivity
                  ? 'justify-center text-center'
                  : (size < 40 ? 'hidden' : size < 60 ? 'flex-row justify-center gap-1.5' : 'flex-col justify-center text-center py-1')
               )
             : (isCity ? 'justify-center flex-col text-center py-0.5' : 'justify-center flex-col text-center')}
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
             <ActivityTypeIcon type={primaryActivityType || 'general'} size={14} className={`${isInactiveActivity ? 'opacity-60' : 'opacity-70'} ${vertical && item.duration * pixelsPerDay >= 60 ? 'mb-1' : ''}`} />
        )}

        {!isEmptyTravel && !shouldRotateVerticalCityLabel && (
            <span
                className={`font-semibold select-none leading-tight 
                    ${isCompactVerticalActivity
                        ? 'w-full truncate whitespace-nowrap text-center'
                        : `${isTravel ? 'text-xs w-full whitespace-normal line-clamp-2' : (isCity ? 'text-[12px] md:text-[14px] w-full whitespace-normal line-clamp-2' : 'text-sm whitespace-normal')}
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
        {!isEmptyTravel && shouldRotateVerticalCityLabel && (
            <span
                className="font-semibold select-none text-[10px] whitespace-nowrap tracking-[0.03em]"
                style={{
                    writingMode: 'vertical-rl',
                    textOrientation: 'mixed',
                    transform: 'rotate(180deg)',
                    lineHeight: 1.05,
                    maxHeight: '100%',
                }}
            >
                {isLoadingItem ? 'Loading city...' : item.title}
                {cityPlanOptionIndex > 0 ? ` • Option ${cityPlanOptionIndex + 1}` : ''}
            </span>
        )}

        {/* Duration Display */}
        {!isCity && !isTravel && !isEmptyTravel && (
            <span className={`text-[10px] opacity-80 select-none 
                ${vertical 
                    ? (item.duration * pixelsPerDay < 60 ? 'hidden' : 'mt-0.5 block')
                    : 'hidden sm:block'}
            `}>
                {item.duration * pixelsPerDay > 30 ? (item.duration === 1 ? '1D' : `${Number(item.duration.toFixed(1))}D`) : ''}
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
                ${isSelected ? 'bg-white border border-accent-300 text-accent-500 group-hover/handle:bg-accent-500 group-hover/handle:text-white group-hover/handle:border-accent-600' : 'bg-white/80 border border-gray-200 group-hover/handle:bg-accent-500 group-hover/handle:border-accent-600 group-hover/handle:text-white'}
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
                ${isSelected ? 'bg-white border border-accent-300 text-accent-500 group-hover/handle:bg-accent-500 group-hover/handle:text-white group-hover/handle:border-accent-600' : 'bg-white/80 border border-gray-200 group-hover/handle:bg-accent-500 group-hover/handle:border-accent-600 group-hover/handle:text-white'}
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
