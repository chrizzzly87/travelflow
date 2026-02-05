import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ITimelineItem, TransportMode, ActivityType, IHotel } from '../types';
import { X, MapPin, Clock, Trash2, Plane, Train, Bus, Ship, Car, Hotel, PlusCircle, Search, AlertTriangle, ExternalLink, Sparkles, RefreshCw, Maximize, Minimize, Minus, Plus, Palette, Map } from 'lucide-react';
import { suggestActivityDetails, generateCityNotesAddition } from '../services/geminiService';
import type { CityNotesEnhancementMode } from '../services/geminiService';
import { ALL_ACTIVITY_TYPES, TRAVEL_COLOR, addDays, formatDate, getStoredAppLanguage, PRESET_COLORS, getActivityColorByTypes, normalizeActivityTypes } from '../utils';
import { useGoogleMaps } from './GoogleMapsLoader';
import { MarkdownEditor } from './MarkdownEditor';
import type { MarkdownAiAction } from './MarkdownEditor';
import { ActivityTypeIcon, formatActivityTypeLabel, getActivityTypeButtonClass } from './ActivityTypeVisuals';

interface DetailsPanelProps {
  item: ITimelineItem | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (id: string, updates: Partial<ITimelineItem>) => void;
  onDelete: (id: string) => void;
  tripStartDate: string;
  onForceFill?: (id: string) => void;
  forceFillMode?: 'stretch' | 'shrink';
  forceFillLabel?: string;
  variant?: 'overlay' | 'sidebar'; // New Prop
}

interface PendingCityNotesProposal {
    actionLabel: string;
    addition: string;
}

const CITY_NOTES_AI_ACTIONS: MarkdownAiAction[] = [
    {
        id: 'expand-checklists',
        label: 'Extend Must See/Try/Do',
        description: 'Adds fresh checkbox ideas for attractions, food, and activities.'
    },
    {
        id: 'local-tips',
        label: 'Add practical local tips',
        description: 'Adds transport, timing, reservation, and safety/crowd tips.'
    },
    {
        id: 'day-plan',
        label: 'Add day-plan ideas',
        description: 'Adds lightweight morning/afternoon/evening checklist ideas.'
    }
];

const appendNotes = (existing: string, addition: string): string => {
    const trimmedExisting = existing.trim();
    const trimmedAddition = addition.trim();

    if (!trimmedAddition) return existing;
    if (!trimmedExisting) return trimmedAddition;
    return `${existing.trimEnd()}\n\n${trimmedAddition}`;
};

export const DetailsPanel: React.FC<DetailsPanelProps> = ({ 
    item, 
    isOpen, 
    onClose, 
    onUpdate, 
    onDelete, 
    tripStartDate, 
    onForceFill,
    forceFillMode,
    forceFillLabel,
    variant = 'overlay'
}) => {
  const [loading, setLoading] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [aiStatus, setAiStatus] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [pendingNotesProposal, setPendingNotesProposal] = useState<PendingCityNotesProposal | null>(null);
  const [cachedItem, setCachedItem] = useState<ITimelineItem | null>(item);

  // Search State for Hotels
  const [hotelQuery, setHotelQuery] = useState('');
  const [isSearchingHotels, setIsSearchingHotels] = useState(false);
  const [hotelResults, setHotelResults] = useState<{name: string, address: string}[]>([]);
  
  // Places Service
  const [placesService, setPlacesService] = useState<any>(null);
  const placesServiceDivRef = useRef<HTMLDivElement>(null);
  const [apiKeyError, setApiKeyError] = useState(false);

  // Custom Drawer State
  const [isRendered, setIsRendered] = useState(isOpen);
  const [isVisible, setIsVisible] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef<number | null>(null);
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);

  const { isLoaded } = useGoogleMaps();
  const mapLanguage = getStoredAppLanguage();

  // Initialize Google Places Service (TextSearch)
  useEffect(() => {
    if (!isOpen && variant === 'overlay') return;
    if (!item && variant === 'sidebar') return; 
    
    setApiKeyError(false);

    if (isLoaded && (window as any).google?.maps?.places && placesServiceDivRef.current) {
        try {
            // PlacesService requires a Map or an HTML Element (hidden div works)
            const service = new (window as any).google.maps.places.PlacesService(placesServiceDivRef.current);
            setPlacesService(service);
        } catch (e) {
            console.error("Places Service Init Failed", e);
            setApiKeyError(true);
        }
    }
  }, [isOpen, item, variant, isLoaded]);

  // Handle Mount/Unmount Animation for Overlay
  useEffect(() => {
    if (variant === 'sidebar') {
        setIsRendered(!!item);
        setIsVisible(!!item);
        return;
    }

    let rafId: number;
    let timerId: ReturnType<typeof setTimeout>;

    if (isOpen) {
        setIsRendered(true);
        rafId = requestAnimationFrame(() => setIsVisible(true));
    } else {
        setIsVisible(false);
        setIsColorPickerOpen(false); 
        timerId = setTimeout(() => {
            setIsRendered(false);
            setDragOffset(0);
        }, 300);
    }

    return () => {
        if (rafId) cancelAnimationFrame(rafId);
        if (timerId) clearTimeout(timerId);
    };
  }, [isOpen, item, variant]);

  // Handle Escape Key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (isOpen && e.key === 'Escape') {
            if (isColorPickerOpen) setIsColorPickerOpen(false);
            else onClose();
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, isColorPickerOpen]);

  // Cache Item logic
  useEffect(() => {
    if (item) {
        setCachedItem(item);
        setHotelQuery('');
        setHotelResults([]);
        setIsColorPickerOpen(false);
        setAiStatus(null);
        setAiError(null);
        setPendingNotesProposal(null);
    }
  }, [item]);

  useEffect(() => {
      if (!aiStatus || isEnhancing) return;
      const timer = setTimeout(() => setAiStatus(null), 5000);
      return () => clearTimeout(timer);
  }, [aiStatus, isEnhancing]);

  const displayItem = item || cachedItem;

  // -- Data Fetching & Helpers (Same as before) --
  const fetchDetails = async () => {
      if (!displayItem) return;
      setLoading(true);
      try {
          const details = await suggestActivityDetails(displayItem.title, displayItem.location || "");
          onUpdate(displayItem.id, {
              aiInsights: { cost: details.cost, bestTime: details.bestTime, tips: details.tips },
          });
      } finally {
          setLoading(false);
      }
  };

  const handleEnhanceNotes = async (mode: CityNotesEnhancementMode) => {
      if (!displayItem) return;
      const action = CITY_NOTES_AI_ACTIONS.find((entry) => entry.id === mode);
      const actionLabel = action?.label || 'Enhance notes';

      setAiError(null);
      setAiStatus(`Generating: ${actionLabel}...`);
      setIsEnhancing(true);

      try {
          const addition = await generateCityNotesAddition(
              displayItem.location || displayItem.title,
              displayItem.description || '',
              mode
          );
          const trimmedAddition = addition.trim();

          if (!trimmedAddition) {
              setPendingNotesProposal(null);
              setAiStatus('No new suggestions were generated for your current notes.');
              return;
          }

          setPendingNotesProposal({
              actionLabel,
              addition: trimmedAddition,
          });
          setAiStatus('Draft ready. Review the preview and accept or decline.');
      } catch (error) {
          console.error('Failed to generate city note proposal', error);
          setAiError('AI request failed. Please try again.');
          setAiStatus(null);
      } finally {
          setIsEnhancing(false);
      }
  };

  const handleAcceptNotesProposal = () => {
      if (!displayItem || !pendingNotesProposal) return;
      const nextNotes = appendNotes(displayItem.description || '', pendingNotesProposal.addition);
      onUpdate(displayItem.id, { description: nextNotes });
      setPendingNotesProposal(null);
      setAiError(null);
      setAiStatus('AI update applied to notes.');
  };

  const handleDeclineNotesProposal = () => {
      setPendingNotesProposal(null);
      setAiError(null);
      setAiStatus('Draft discarded.');
  };

  // Hotel & Link handlers...
  const addHotel = () => {
      if (!displayItem) return;
      const newHotel: IHotel = { id: `hotel-${Date.now()}`, name: '', address: '' };
      onUpdate(displayItem.id, { hotels: [...(displayItem.hotels || []), newHotel] });
  };
  const updateHotel = (hotelId: string, updates: Partial<IHotel>) => {
      if (!displayItem?.hotels) return;
      onUpdate(displayItem.id, { hotels: displayItem.hotels.map(h => h.id === hotelId ? { ...h, ...updates } : h) });
  };
  const removeHotel = (hotelId: string) => {
      if (!displayItem?.hotels) return;
      onUpdate(displayItem.id, { hotels: displayItem.hotels.filter(h => h.id !== hotelId) });
  };
  
  const handleHotelSearch = () => {
      if (!hotelQuery || !displayItem || !placesService) return;
      setIsSearchingHotels(true);
      
      const searchString = `${hotelQuery} in ${displayItem.location || displayItem.title}`;
      
      try {
          const request = {
              query: searchString,
              type: 'lodging' as any // Forcing type to match API expectation
          };

          placesService.textSearch(request, (results: any[], status: any) => {
              setIsSearchingHotels(false);
              if (status === (window as any).google.maps.places.PlacesServiceStatus.OK && results) {
                  setHotelResults(results.map(p => ({ 
                      name: p.name, 
                      address: p.formatted_address 
                  })).slice(0, 5));
              } else {
                  setHotelResults([]);
              }
          });
      } catch (e) {
          console.error("Hotel search error", e);
          setIsSearchingHotels(false);
      }
  };
  
  const selectHotelResult = (result: {name: string, address: string}) => {
      if (!displayItem) return;
      onUpdate(displayItem.id, { hotels: [...(displayItem.hotels || []), { id: `hotel-${Date.now()}`, name: result.name, address: result.address }] });
      setHotelResults([]);
      setHotelQuery('');
  };
  const openExternalLink = (provider: 'gyg' | 'tripadvisor' | 'viator' | 'airbnb') => {
      if (!displayItem) return;
      const query = encodeURIComponent(`${displayItem.title} ${displayItem.location || ''}`);
      const itemStartDate = isValidDate ? addDays(new Date(tripStartDate), displayItem.startDateOffset) : new Date();
      const dateStr = isValidDate ? itemStartDate.toISOString().split('T')[0] : '';
      let url = '';
      if(provider === 'gyg') url = `https://www.getyourguide.com/s?q=${query}&date_from=${dateStr}`;
      if(provider === 'tripadvisor') url = `https://www.tripadvisor.com/Search?q=${query}`;
      if(provider === 'viator') url = `https://www.viator.com/searchResults/all?text=${query}`;
      if(provider === 'airbnb') url = `https://www.airbnb.com/s/${encodeURIComponent(displayItem.location || '')}/experiences?query=${encodeURIComponent(displayItem.title)}`;
      if (url) window.open(url, '_blank');
  };
  
  // Touch Handlers (Overlay Mobile)
  const handleTouchStart = (e: React.TouchEvent) => { if (variant === 'overlay' && window.innerWidth < 640) { dragStartY.current = e.touches[0].clientY; setIsDragging(true); }};
  const handleTouchMove = (e: React.TouchEvent) => { if (variant === 'overlay' && window.innerWidth < 640 && dragStartY.current !== null) { const delta = e.touches[0].clientY - dragStartY.current; if (delta > 0) setDragOffset(delta); }};
  const handleTouchEnd = () => { if (variant === 'overlay' && window.innerWidth < 640) { setIsDragging(false); dragStartY.current = null; if (dragOffset > 100) onClose(); else setDragOffset(0); }};


  if (!isRendered || !displayItem) return null;

  const isTransport = displayItem.type === 'travel' || displayItem.type === 'travel-empty';
  const isActivity = displayItem.type === 'activity';
  const isCity = displayItem.type === 'city';
  const aiDetails = displayItem.aiInsights;
  const proposedNotesPreview = pendingNotesProposal
      ? appendNotes(displayItem.description || '', pendingNotesProposal.addition)
      : '';
  
  // Logic Vars
  let selectedActivityTypes: ActivityType[] = [];
  if (isActivity) selectedActivityTypes = normalizeActivityTypes(displayItem.activityType);
  const toggleActivityType = (type: ActivityType) => {
      let newTypes = [...selectedActivityTypes];
      if (newTypes.includes(type)) {
          if (newTypes.length > 1) {
              newTypes = newTypes.filter(t => t !== type);
          }
      } else {
          newTypes.push(type);
      }
      const normalizedTypes = normalizeActivityTypes(newTypes);
      onUpdate(displayItem.id, { activityType: normalizedTypes, color: getActivityColorByTypes(normalizedTypes) });
  };
  const handleTransportConvert = (mode: TransportMode) => {
      onUpdate(displayItem.id, { type: 'travel', transportMode: mode, title: `${mode.charAt(0).toUpperCase() + mode.slice(1)} Travel`, color: TRAVEL_COLOR, duration: Math.max(0.1, displayItem.duration) });
  };
  const tripStart = new Date(tripStartDate);
  const isValidDate = !isNaN(tripStart.getTime());
  const itemStartDate = isValidDate ? addDays(tripStart, displayItem.startDateOffset) : new Date();
  const itemEndDate = isValidDate ? addDays(tripStart, displayItem.startDateOffset + displayItem.duration) : new Date();
  const handleUpdateStart = (delta: number) => onUpdate(displayItem.id, { startDateOffset: Math.max(0, displayItem.startDateOffset + delta), duration: Math.max(0.5, displayItem.duration - delta) });
  const handleUpdateEnd = (delta: number) => onUpdate(displayItem.id, { duration: Math.max(0.5, displayItem.duration + delta) });
  
  const effectiveColor = isActivity ? getActivityColorByTypes(displayItem.activityType) : displayItem.color;
  const colorParts = effectiveColor ? effectiveColor.split(' ') : ['bg-gray-100'];
  const bgClass = colorParts[0] || 'bg-gray-100';
  const textClass = colorParts[2] || 'text-gray-800';

  const Content = (
      <div className={`flex flex-col h-full w-full min-w-0 bg-gray-50 ${variant === 'sidebar' ? 'border-l border-gray-200' : 'rounded-t-[20px] sm:rounded-2xl'}`}>
          {/* Header */}
          <div className="bg-white p-4 sm:p-6 border-b border-gray-100 pb-6 relative flex-shrink-0">
             {variant === 'overlay' && (
                <div 
                    className="w-full flex sm:hidden items-center justify-center p-3 cursor-grab absolute top-0 left-0 right-0"
                    onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
                >
                    <div className="w-12 h-1.5 rounded-full bg-gray-300" />
                </div>
             )}
             
             <div className="flex justify-between items-start mb-4 pr-8">
                  <div className="flex items-center gap-2">
                      <div className={`px-2 py-1 rounded text-xs font-bold uppercase tracking-wider ${bgClass} ${textClass} bg-opacity-50 transition-colors`}>{displayItem.type}</div>
                      {isCity && (
                        <div className="relative">
                            <button onClick={() => setIsColorPickerOpen(!isColorPickerOpen)} className="p-1 hover:bg-gray-100 rounded-full text-gray-400 hover:text-indigo-600 transition-colors"><Palette size={14} /></button>
                            {isColorPickerOpen && (
                                <div className="absolute top-full left-0 mt-2 p-2 bg-white rounded-lg shadow-xl border border-gray-100 z-50 grid grid-cols-4 gap-2 w-48">
                                    {PRESET_COLORS.map((color) => (
                                        <button key={color.name} onClick={() => { onUpdate(displayItem.id, { color: color.class }); setIsColorPickerOpen(false); }} className={`w-8 h-8 rounded-full border-2 hover:scale-110 transition-transform ${displayItem.color === color.class ? 'border-gray-900 shadow-inner' : 'border-transparent hover:border-gray-200'}`} style={{ backgroundColor: color.hex }} title={color.name} />
                                    ))}
                                </div>
                            )}
                        </div>
                      )}
                  </div>
                  <button onClick={() => { onDelete(displayItem.id); onClose(); }} className="p-2 bg-red-50 text-red-500 rounded-full hover:bg-red-100 transition-colors sm:hidden"><Trash2 size={20} /></button>
                  <button onClick={() => { onDelete(displayItem.id); onClose(); }} className="hidden sm:block text-red-400 hover:text-red-600 transition-colors text-xs font-medium px-2 py-1">Delete</button>
                  {variant === 'overlay' && <div className="hidden sm:flex absolute top-4 right-4 z-10"><button onClick={onClose} className="p-2 bg-gray-200 hover:bg-gray-300 rounded-full text-gray-600"><X size={18} /></button></div>}
                  {variant === 'sidebar' && <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-500"><X size={16} /></button>}
             </div>
             
             <textarea 
                value={displayItem.title} 
                onChange={(e) => onUpdate(displayItem.id, { title: e.target.value })} 
                className="text-2xl sm:text-3xl font-bold text-gray-900 bg-transparent border-none placeholder-gray-300 focus:ring-0 p-0 w-full resize-none overflow-hidden leading-tight" 
                rows={1} placeholder="Title" 
                style={{ fieldSizing: 'content', minHeight: '2.5rem' } as any}
             />
             
             <div className="flex flex-col gap-3 mt-4">
                 <div className="flex items-center text-gray-600">
                    <Clock size={18} className="mr-3 text-indigo-500" />
                    {isTransport ? (
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">Duration:</span>
                            <input type="number" min="0.5" value={Math.round(displayItem.duration * 24 * 10) / 10} onChange={(e) => { const h = parseFloat(e.target.value); if (!isNaN(h) && h > 0) onUpdate(displayItem.id, { duration: h / 24 }); }} className="w-16 p-1 border-b border-gray-300 bg-transparent text-center font-bold text-gray-900 focus:border-indigo-500 outline-none"/>
                            <span className="font-medium text-sm">hours</span>
                        </div>
                    ) : (
                        <span className="font-medium">{Number(displayItem.duration.toFixed(1))} day{displayItem.duration !== 1 ? 's' : ''}</span>
                    )}
                 </div>
                 {displayItem.location && ( <div className="flex items-center text-gray-600"><MapPin size={18} className="mr-3 text-indigo-500" /><span className="font-medium">{displayItem.location}</span></div> )}
             </div>
          </div>

          {/* Body */}
          <div className="p-4 sm:p-6 space-y-6 flex-1 overflow-y-auto min-w-0">
             {isCity && isValidDate && (
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-4">
                    <div className="flex justify-between items-center pb-2 border-b border-gray-50">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Schedule</h3>
                        <div className="flex items-center gap-2">
                            <div className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">{Number(displayItem.duration.toFixed(1))} Nights</div>
                            {onForceFill && forceFillLabel && (
                                <button
                                    onClick={() => onForceFill(displayItem.id)}
                                    className="px-2 py-1 hover:bg-gray-100 rounded text-gray-500 hover:text-indigo-600 flex items-center gap-1 text-[10px] font-semibold"
                                    title={forceFillLabel || 'Occupy available space'}
                                >
                                    {(forceFillMode === 'shrink') ? <Minimize size={12} /> : <Maximize size={12} />}
                                    <span>{forceFillLabel || 'Occupy available space'}</span>
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center justify-between"><div className="flex flex-col"><span className="text-[10px] font-bold text-gray-400 uppercase">Arrival</span><span className="text-sm font-bold text-gray-800">{formatDate(itemStartDate)}</span></div><div className="flex items-center gap-1 bg-gray-50 rounded-lg p-1"><button onClick={() => handleUpdateStart(-1)} className="p-1.5 hover:bg-white hover:shadow-sm rounded-md transition-all text-gray-500 hover:text-indigo-600"><Minus size={14} /></button><span className="text-[10px] font-bold text-gray-400 px-1 select-none">START</span><button onClick={() => handleUpdateStart(1)} className="p-1.5 hover:bg-white hover:shadow-sm rounded-md transition-all text-gray-500 hover:text-indigo-600"><Plus size={14} /></button></div></div>
                    <div className="flex items-center justify-between"><div className="flex flex-col"><span className="text-[10px] font-bold text-gray-400 uppercase">Departure</span><span className="text-sm font-bold text-gray-800">{formatDate(itemEndDate)}</span></div><div className="flex items-center gap-1 bg-gray-50 rounded-lg p-1"><button onClick={() => handleUpdateEnd(-1)} className="p-1.5 hover:bg-white hover:shadow-sm rounded-md transition-all text-gray-500 hover:text-indigo-600"><Minus size={14} /></button><span className="text-[10px] font-bold text-gray-400 px-1 select-none">END</span><button onClick={() => handleUpdateEnd(1)} className="p-1.5 hover:bg-white hover:shadow-sm rounded-md transition-all text-gray-500 hover:text-indigo-600"><Plus size={14} /></button></div></div>
                </div>
             )}
             
             {isCity && (
                 <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                     <div className="flex justify-between items-center mb-4"><h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5"><Hotel size={14} /> Accomodation</h3><button onClick={addHotel} className="text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 p-1 rounded transition-colors text-xs font-medium">+ Manual</button></div>
                     <div className="mb-4 relative">
                        {/* Hidden Places Service Container */}
                        <div ref={placesServiceDivRef} className="hidden"></div>

                        {apiKeyError ? <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-xs text-red-600 flex items-start gap-2"><AlertTriangle size={14} className="mt-0.5 flex-shrink-0" /><div><strong>Maps Search Unavailable</strong><br/>No valid API Key.</div></div> : (
                            <><div className="flex gap-2"><div className="relative flex-1"><input type="text" value={hotelQuery} onChange={(e) => setHotelQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleHotelSearch()} placeholder="Search hotels..." className="w-full pl-8 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 focus:ring-1 focus:ring-indigo-500 outline-none"/><Search size={14} className="absolute left-2.5 top-2.5 text-gray-400" /></div><button onClick={handleHotelSearch} disabled={isSearchingHotels || !hotelQuery || !placesService} className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 disabled:opacity-50">{isSearchingHotels ? '...' : 'Find'}</button></div>{hotelResults.length > 0 && <div className="mt-2 space-y-2">{hotelResults.map((result, idx) => <div key={idx} onClick={() => selectHotelResult(result)} className="bg-gray-50 hover:bg-indigo-50 border border-gray-200 hover:border-indigo-200 rounded-lg p-2 cursor-pointer transition-all"><div className="font-bold text-sm text-gray-800">{result.name}</div><div className="text-xs text-gray-500 truncate">{result.address}</div></div>)}</div>}</>
                        )}
                     </div>
                     <div className="space-y-6">{displayItem.hotels?.map((hotel) => (<div key={hotel.id} className="bg-gray-50 rounded-lg p-3 border border-gray-200 group"><div className="flex justify-between items-start mb-2"><input type="text" value={hotel.name} onChange={(e) => updateHotel(hotel.id, { name: e.target.value })} placeholder="Hotel Name" className="font-bold text-gray-800 bg-transparent border-none p-0 focus:ring-0 w-full placeholder-gray-400 text-sm"/><button onClick={() => removeHotel(hotel.id)} className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100"><Trash2 size={14} /></button></div><div className="flex items-start gap-2 mb-3"><MapPin size={14} className="text-gray-400 mt-0.5 flex-shrink-0" /><input type="text" value={hotel.address} onChange={(e) => updateHotel(hotel.id, { address: e.target.value })} placeholder="Address" className="text-xs text-gray-600 bg-transparent border-none p-0 focus:ring-0 w-full placeholder-gray-400"/></div>{hotel.address && <div className="rounded-lg overflow-hidden h-32 w-full bg-gray-200 border border-gray-300 relative"><iframe width="100%" height="100%" frameBorder="0" style={{ border: 0 }} src={`https://maps.google.com/maps?q=${encodeURIComponent(hotel.address)}&t=&z=13&ie=UTF8&iwloc=&output=embed&hl=${encodeURIComponent(mapLanguage)}`} title="Hotel"></iframe></div>}</div>))}{(!displayItem.hotels || displayItem.hotels.length === 0) && <div className="text-xs text-center text-gray-400 py-2 border-2 border-dashed border-gray-100 rounded-lg">No accomodation</div>}</div>
                 </div>
             )}

             {isTransport && (
                 <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                     <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Transportation Mode</h3>
                     <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(96px, 1fr))' }}>
                         {(['na', 'plane', 'train', 'bus', 'car', 'boat'] as TransportMode[]).map(mode => (
                             <button 
                                 key={mode} 
                                 onClick={() => handleTransportConvert(mode)} 
                                 className={`flex flex-col items-center justify-center w-full h-20 rounded-xl border-2 transition-all ${displayItem.transportMode === mode ? 'bg-indigo-50 border-indigo-500 text-indigo-700' : 'bg-gray-50 border-gray-100 text-gray-400 hover:border-gray-200'}`}
                             >
                                 {mode === 'na' && <Map size={24} />}
                                 {mode === 'plane' && <Plane size={24} />}
                                 {mode === 'train' && <Train size={24} />}
                                 {mode === 'bus' && <Bus size={24} />}
                                 {mode === 'car' && <Car size={24} />}
                                 {mode === 'boat' && <Ship size={24} />}
                                 <span className="text-[10px] font-bold mt-2 uppercase">{mode === 'na' ? 'N/A' : mode}</span>
                             </button>
                         ))}
                     </div>
                 </div>
             )}

             {isActivity && (
                 <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                     <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Activity Types</h3>
                     <div className="flex flex-wrap gap-2 mb-6">
                        {ALL_ACTIVITY_TYPES.map(type => {
                            const isSelectedType = selectedActivityTypes.includes(type);
                            return (
                                <button
                                    key={type}
                                    onClick={() => toggleActivityType(type)}
                                    className={`flex items-center px-3 py-2 rounded-lg border transition-all text-xs font-bold uppercase tracking-wide ${getActivityTypeButtonClass(type, isSelectedType)}`}
                                >
                                    <ActivityTypeIcon type={type} size={13} className="mr-1.5" />
                                    <span>{formatActivityTypeLabel(type)}</span>
                                </button>
                            );
                        })}
                     </div>
                     <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Check Availability</h3>
                     <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}><button onClick={() => openExternalLink('gyg')} className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-[#ff5533]/5 text-[#ff5533] border border-[#ff5533]/20 hover:bg-[#ff5533]/10 font-medium text-xs">GYG <ExternalLink size={12} /></button><button onClick={() => openExternalLink('tripadvisor')} className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-[#34e0a1]/10 text-[#00aa6c] border border-[#34e0a1]/20 hover:bg-[#34e0a1]/20 font-medium text-xs">TripAdvisor <ExternalLink size={12} /></button></div>
                 </div>
             )}

             <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex-1">
                <div className="flex justify-between items-center mb-2"><h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Notes</h3></div>
                <MarkdownEditor
                    key={displayItem.id}
                    value={displayItem.description || ''}
                    onChange={(val) => onUpdate(displayItem.id, { description: val })}
                    aiActions={isCity ? CITY_NOTES_AI_ACTIONS : undefined}
                    onAiActionSelect={isCity ? ((actionId) => {
                        if (actionId === 'expand-checklists' || actionId === 'local-tips' || actionId === 'day-plan') {
                            handleEnhanceNotes(actionId);
                        }
                    }) : undefined}
                    isGenerating={isEnhancing}
                    aiStatus={isCity ? aiStatus : null}
                />
                {aiError && (
                    <div className="mt-3 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                        {aiError}
                    </div>
                )}
                {isCity && pendingNotesProposal && (
                    <div className="mt-4 border border-indigo-100 rounded-xl bg-indigo-50/40 overflow-hidden">
                        <div className="px-4 py-3 border-b border-indigo-100 bg-white/80">
                            <div className="text-xs font-semibold text-indigo-700">AI Draft Preview</div>
                            <div className="text-[11px] text-indigo-600 mt-1">
                                Action: {pendingNotesProposal.actionLabel}
                            </div>
                        </div>
                        <div className="p-4 bg-white">
                            <MarkdownEditor value={proposedNotesPreview} readOnly />
                        </div>
                        <div className="px-4 py-3 bg-indigo-50 border-t border-indigo-100 flex items-center justify-end gap-2">
                            <button
                                onClick={handleDeclineNotesProposal}
                                className="px-3 py-1.5 text-xs font-semibold text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50"
                            >
                                Decline
                            </button>
                            <button
                                onClick={handleAcceptNotesProposal}
                                className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
                            >
                                Accept and Apply
                            </button>
                        </div>
                    </div>
                )}
                {(aiDetails || loading) && isActivity && (
                    <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-100 rounded-xl p-4 mt-6">
                        <div className="flex items-center mb-3 justify-between">
                            <div className="flex items-center gap-2">
                                <Sparkles size={16} className="text-indigo-500 animate-pulse" />
                                <h3 className="text-sm font-semibold text-indigo-900">AI Insights</h3>
                            </div>
                            <button onClick={fetchDetails} className={`p-1.5 rounded-full hover:bg-white text-indigo-500 ${loading ? 'animate-spin' : ''}`}><RefreshCw size={16} /></button>
                        </div>
                        {loading && !aiDetails ? (
                            <div className="text-sm text-indigo-600/70 py-2">Loading...</div>
                        ) : (
                            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
                                <div className="bg-white p-3 rounded-lg border border-indigo-100 shadow-sm">
                                    <span className="text-[10px] font-bold text-indigo-400 uppercase">Cost</span>
                                    <span className="text-sm font-medium">{aiDetails?.cost || 'N/A'}</span>
                                </div>
                                <div className="bg-white p-3 rounded-lg border border-indigo-100 shadow-sm">
                                    <span className="text-[10px] font-bold text-indigo-400 uppercase">Best Time</span>
                                    <span className="text-sm font-medium">{aiDetails?.bestTime || 'N/A'}</span>
                                </div>
                                <div className="bg-white p-3 rounded-lg border border-indigo-100 shadow-sm" style={{ gridColumn: '1 / -1' }}>
                                    <span className="text-[10px] font-bold text-indigo-400 uppercase">Tip</span>
                                    <span className="text-sm font-medium">{aiDetails?.tips || 'N/A'}</span>
                                </div>
                            </div>
                        )}
                    </div>
                )}
             </div>
          </div>
      </div>
  );

  // If sidebar mode, return directly (no portal)
  if (variant === 'sidebar') {
      return Content;
  }

  // Else Overlay mode (Portal)
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex justify-end pointer-events-none">
        <div className={`absolute inset-0 bg-black/30 backdrop-blur-[2px] transition-opacity duration-300 pointer-events-auto ${isVisible ? 'opacity-100' : 'opacity-0'}`} onClick={onClose} />
        <div 
            className={`bg-gray-100 shadow-2xl flex flex-col pointer-events-auto will-change-transform absolute w-full h-[85vh] bottom-0 rounded-t-[20px] left-0 right-0 sm:top-2 sm:bottom-2 sm:right-2 sm:w-[450px] sm:h-auto sm:rounded-2xl sm:left-auto`}
            style={{ transform: window.innerWidth < 640 ? `translateY(${!isVisible ? '100%' : `${dragOffset}px`})` : `translateX(${!isVisible ? '110%' : '0%'})`, transition: isDragging ? 'none' : 'transform 300ms cubic-bezier(0.32, 0.72, 0, 1)' }}
        >
          {Content}
        </div>
    </div>,
    document.body
  );
};
