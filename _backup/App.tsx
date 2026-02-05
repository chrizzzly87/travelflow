import React, { useState, useEffect, useRef } from 'react';
import { Timeline } from './components/Timeline';
import { VerticalTimeline } from './components/VerticalTimeline';
import { DetailsPanel } from './components/DetailsPanel';
import { TripManager } from './components/TripManager';
import { CountrySelect } from './components/CountrySelect';
import { ItineraryMap } from './components/ItineraryMap';
import { DateRangePicker } from './components/DateRangePicker';
import { DeleteCityModal } from './components/DeleteCityModal';
import { AddActivityModal } from './components/AddActivityModal';
import { AddCityModal } from './components/AddCityModal';
import { SettingsModal } from './components/SettingsModal';
import { PrintLayout } from './components/PrintLayout';
import { LoadingSkeleton } from './components/LoadingSkeleton';
import { ITrip, ITimelineItem, DeleteStrategy } from './types';
import { generateItinerary } from './services/geminiService';
import { saveTrip, getAllTrips } from './services/storageService';
import { compressTripToUrl, decompressTripFromUrl, generateTripTitle, TRAVEL_EMPTY_COLOR, getDefaultTripDates, BASE_PIXELS_PER_DAY } from './utils';
import { Sparkles, Loader2, Plane, MapPin, AlignLeft, FilePlus, Folder, Share2, Check, List, Settings, Wallet, Clock, ChevronDown, ChevronUp, GripHorizontal, GripVertical, Pencil, AlertTriangle, ZoomIn, ZoomOut } from 'lucide-react';
import { getDaysDifference, getRandomCityColor, addDays } from './utils';
import { CountryInfo } from './components/CountryInfo';
import { createThailandTrip } from './data/exampleTrips';

const App: React.FC = () => {
  const [trip, setTrip] = useState<ITrip | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  
  // UI State
  const [isManagerOpen, setIsManagerOpen] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [deleteModalState, setDeleteModalState] = useState<{ isOpen: boolean, cityId: string | null }>({ isOpen: false, cityId: null });
  const [addActivityState, setAddActivityState] = useState<{ isOpen: boolean, dayOffset: number, location: string }>({ isOpen: false, dayOffset: 0, location: '' });
  const [isAddCityModalOpen, setIsAddCityModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Title Editing State
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitleValue, setEditTitleValue] = useState('');

  // View Mode for Print/Export - Initialize from URL to avoid race conditions with effects
  const [viewMode, setViewMode] = useState<'planner' | 'print'>(() => {
      if (typeof window !== 'undefined') {
          const params = new URLSearchParams(window.location.search);
          return params.get('mode') === 'print' ? 'print' : 'planner';
      }
      return 'planner';
  });

  // Layout State with Persistence (URL -> LocalStorage -> Default based on Screen Size)
  const [layoutMode, setLayoutMode] = useState<'vertical' | 'horizontal'>(() => {
      // 1. Check URL
      const params = new URLSearchParams(window.location.search);
      const urlLayout = params.get('layout');
      if (urlLayout === 'vertical' || urlLayout === 'horizontal') return urlLayout;
      
      // 2. Check LocalStorage
      try {
          const storedLayout = localStorage.getItem('tf_layout_mode');
          if (storedLayout === 'vertical' || storedLayout === 'horizontal') return storedLayout;
      } catch (e) {}

      // 3. Default: Horizontal (Map Right) for Desktop, Vertical (Map Top) for Mobile
      if (typeof window !== 'undefined') {
          return window.innerWidth < 768 ? 'vertical' : 'horizontal';
      }
      return 'vertical';
  });
  
  // Timeline View (Horizontal vs Vertical Timeline Component)
  const [timelineView, setTimelineView] = useState<'horizontal' | 'vertical'>(() => {
      try {
          const stored = localStorage.getItem('tf_timeline_view') as 'horizontal' | 'vertical';
          if (stored) return stored;
      } catch (e) {}
      // Default to Vertical timeline on mobile, Horizontal on desktop
      if (typeof window !== 'undefined') {
          return window.innerWidth < 768 ? 'vertical' : 'horizontal';
      }
      return 'horizontal';
  });

  // Zoom State
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const pixelsPerDay = BASE_PIXELS_PER_DAY * zoomLevel;

  // Map dimensions (Safe initialization)
  const [verticalMapHeight, setVerticalMapHeight] = useState(() => {
      try {
          const stored = localStorage.getItem('tf_map_height_v');
          if (stored) {
              const val = parseInt(stored, 10);
              if (!isNaN(val)) return val;
          }
      } catch (e) {}
      // Default to 25% of screen height
      if (typeof window !== 'undefined') return Math.floor(window.innerHeight * 0.25);
      return 250;
  });
  const [horizontalMapWidth, setHorizontalMapWidth] = useState(() => {
      try {
          const stored = localStorage.getItem('tf_map_width_h');
          if (stored) {
              const val = parseInt(stored, 10);
              if (!isNaN(val)) return val;
          }
      } catch (e) {}
      return 35;
  });
  
  // Side Panel Width (Safe initialization)
  const [sidePanelWidth, setSidePanelWidth] = useState(() => {
      try {
          const stored = localStorage.getItem('tf_side_width');
          if (stored) {
              const val = parseInt(stored, 10);
              if (!isNaN(val)) return val;
          }
      } catch (e) {}
      return 400;
  });

  // Resizing State
  const [isResizing, setIsResizing] = useState(false);
  // Distinguish which boundary we are resizing
  const [resizeTarget, setResizeTarget] = useState<'map' | 'sidepanel' | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const timelineAreaRef = useRef<HTMLDivElement>(null);

  // Generator State
  const defaultDates = getDefaultTripDates();
  
  // Safe localStorage hooks
  const useSafeLocalStorage = (key: string, defaultValue: string) => {
      return useState(() => {
          try {
              return localStorage.getItem(key) || defaultValue;
          } catch {
              return defaultValue;
          }
      });
  };

  const [destination, setDestination] = useSafeLocalStorage('tf_destination', '');
  const [startDate, setStartDate] = useSafeLocalStorage('tf_startDate', defaultDates.startDate);
  const [endDate, setEndDate] = useSafeLocalStorage('tf_endDate', defaultDates.endDate);
  const [notes, setNotes] = useSafeLocalStorage('tf_notes', '');
  
  // Advanced Generator Options
  const [isRoundTrip, setIsRoundTrip] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [numCities, setNumCities] = useState<number | ''>('');
  const [specificCities, setSpecificCities] = useState('');
  const [budget, setBudget] = useState('Medium');
  const [pace, setPace] = useState('Balanced');

  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const duration = getDaysDifference(startDate, endDate);

  // Responsive Layout Effect: Force vertical on mobile
  useEffect(() => {
      const handleResize = () => {
          if (window.innerWidth < 768) {
              // Only enforce if not already vertical to avoid redundant updates
              setLayoutMode(prev => prev === 'vertical' ? prev : 'vertical');
          }
      };

      // Initial check
      handleResize();

      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Persistence Effects
  useEffect(() => { localStorage.setItem('tf_destination', destination); }, [destination]);
  useEffect(() => { localStorage.setItem('tf_startDate', startDate); }, [startDate]);
  useEffect(() => { localStorage.setItem('tf_endDate', endDate); }, [endDate]);
  useEffect(() => { localStorage.setItem('tf_notes', notes); }, [notes]);
  
  // Layout & View Persistence (LocalStorage + URL)
  useEffect(() => { 
      localStorage.setItem('tf_layout_mode', layoutMode);
      
      try {
        const params = new URLSearchParams(window.location.search);
        if (layoutMode) params.set('layout', layoutMode);
        
        if (viewMode === 'print') params.set('mode', 'print');
        else params.delete('mode');

        // Check if we are in a blob URL (common in preview environments)
        // Blob URLs generally don't support modifying the path/search via replaceState
        if (window.location.protocol === 'blob:') {
            // Do nothing or only update hash if needed, but here we are updating query params
            // which is risky in blob. We'll skip URL update for query params in blob.
            return;
        }

        const newUrl = `${window.location.pathname}?${params.toString()}${window.location.hash}`;
        window.history.replaceState(null, '', newUrl);
      } catch (e) {
          console.warn("Could not update URL state:", e);
      }

  }, [layoutMode, viewMode]);

  useEffect(() => { localStorage.setItem('tf_timeline_view', timelineView); }, [timelineView]);
  useEffect(() => { localStorage.setItem('tf_map_height_v', verticalMapHeight.toString()); }, [verticalMapHeight]);
  useEffect(() => { localStorage.setItem('tf_map_width_h', horizontalMapWidth.toString()); }, [horizontalMapWidth]);
  useEffect(() => { localStorage.setItem('tf_side_width', sidePanelWidth.toString()); }, [sidePanelWidth]);

  // Load trips / URL State logic
  useEffect(() => {
     // Check URL for mode (Legacy check, state is now init lazily, but keep for safety)
     const params = new URLSearchParams(window.location.search);
     if (params.get('mode') === 'print' && viewMode !== 'print') {
         setViewMode('print');
     }

     const hash = window.location.hash.slice(1);
     if (hash) {
        const sharedTrip = decompressTripFromUrl(hash);
        if (sharedTrip) {
            setTrip(sharedTrip);
            saveTrip(sharedTrip); 
        }
     }
  }, []);

  // Update URL and Title when trip changes
  useEffect(() => {
      if (trip) {
          saveTrip(trip);
          try {
              // In blob environment, this might fail if we try to set the path/search
              if (window.location.protocol === 'blob:') {
                  return;
              }

              const hash = compressTripToUrl(trip);
              const params = new URLSearchParams(window.location.search);
              // Ensure layout is preserved in URL during trip updates
              if (layoutMode) params.set('layout', layoutMode);
              if (viewMode === 'print') params.set('mode', 'print');
              
              const search = params.toString() ? `?${params.toString()}` : '';
              window.history.replaceState(null, '', `${search}#${hash}`);
          } catch (e) {
              console.warn('URL update restricted in this environment', e);
          }
      } else {
          try {
              if (window.location.protocol === 'blob:') return;

              if (window.location.hash) {
                  // Keep search params even if clearing hash
                  const params = new URLSearchParams(window.location.search);
                  const search = params.toString() ? `?${params.toString()}` : '';
                  window.history.replaceState(null, '', `${search}`);
              }
          } catch (e) {
               console.warn('URL update restricted in this environment', e);
          }
      }
  }, [trip, viewMode, layoutMode]);

  // Handle Title Rename
  const handleTitleClick = () => {
      if (!trip) return;
      setEditTitleValue(trip.title);
      setIsEditingTitle(true);
  };

  const handleTitleSave = () => {
      if (!trip) return;
      if (editTitleValue.trim()) {
          setTrip({ ...trip, title: editTitleValue.trim(), updatedAt: Date.now() });
      }
      setIsEditingTitle(false);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleTitleSave();
      if (e.key === 'Escape') setIsEditingTitle(false);
  };

  // --- Zoom Logic ---
  const handleZoomIn = () => setZoomLevel(z => Math.min(z + 0.2, 2.0));
  const handleZoomOut = () => setZoomLevel(z => Math.max(z - 0.2, 0.4));

  // --- Resizing Logic ---
  const startResizingMap = React.useCallback((e: React.MouseEvent) => {
      e.preventDefault();
      setIsResizing(true);
      setResizeTarget('map');
      document.body.style.cursor = layoutMode === 'vertical' ? 'row-resize' : 'col-resize';
      document.body.style.userSelect = 'none';
  }, [layoutMode]);

  const startResizingSidePanel = React.useCallback((e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation(); // Stop event bubbling
      setIsResizing(true);
      setResizeTarget('sidepanel');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
  }, []);

  const stopResizing = React.useCallback(() => {
      setIsResizing(false);
      setResizeTarget(null);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
  }, []);

  const resize = React.useCallback((e: MouseEvent) => {
      if (!isResizing) return;

      if (resizeTarget === 'map' && containerRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect();
        if (layoutMode === 'vertical') {
            let newHeight = e.clientY - containerRect.top;
            newHeight = Math.max(100, Math.min(newHeight, containerRect.height * 0.7));
            setVerticalMapHeight(newHeight);
        } else {
            let newWidthPx = containerRect.right - e.clientX;
            let newWidthPercent = (newWidthPx / containerRect.width) * 100;
            newWidthPercent = Math.max(15, Math.min(newWidthPercent, 70));
            setHorizontalMapWidth(newWidthPercent);
        }
      } else if (resizeTarget === 'sidepanel' && timelineAreaRef.current) {
          // Use timeline area rect instead of main container for correct right-alignment
          const rect = timelineAreaRef.current.getBoundingClientRect();
          let newWidth = rect.right - e.clientX;
          // Apply minimum constraint of 250px and max constraint
          newWidth = Math.max(250, Math.min(newWidth, rect.width * 0.8)); 
          setSidePanelWidth(newWidth);
      }
  }, [isResizing, layoutMode, resizeTarget]);

  useEffect(() => {
      if (isResizing) {
          window.addEventListener('mousemove', resize);
          window.addEventListener('mouseup', stopResizing);
      }
      return () => {
          window.removeEventListener('mousemove', resize);
          window.removeEventListener('mouseup', stopResizing);
      };
  }, [isResizing, resize, stopResizing]);


  const handleUpdateItems = (newItems: ITimelineItem[]) => {
    if (!trip) return;
    setTrip({ ...trip, items: newItems, updatedAt: Date.now() });
  };

  const handleItemUpdate = (id: string, updates: Partial<ITimelineItem>) => {
    if (!trip) return;
    const newItems = trip.items.map(item => 
        item.id === id ? { ...item, ...updates } : item
    );
    setTrip({ ...trip, items: newItems, updatedAt: Date.now() });
  };

  const handleForceFill = (id: string) => {
      if (!trip) return;
      const sortedCities = trip.items
          .filter(i => i.type === 'city')
          .sort((a, b) => a.startDateOffset - b.startDateOffset);
      
      const targetIndex = sortedCities.findIndex(i => i.id === id);
      if (targetIndex === -1) return;

      const targetCity = sortedCities[targetIndex];
      const prevCity = targetIndex > 0 ? sortedCities[targetIndex - 1] : null;
      const nextCity = targetIndex < sortedCities.length - 1 ? sortedCities[targetIndex + 1] : null;

      let newStart = targetCity.startDateOffset;
      let newDuration = targetCity.duration;

      if (prevCity) {
          newStart = prevCity.startDateOffset + prevCity.duration;
      } else {
          newStart = 0;
      }

      if (nextCity) {
          const availableDuration = nextCity.startDateOffset - newStart;
          newDuration = Math.max(0.5, availableDuration);
      }

      const newItems = trip.items.map(item => {
          if (item.id === id) {
              return { ...item, startDateOffset: newStart, duration: newDuration };
          }
          return item;
      });

      setTrip({ ...trip, items: newItems, updatedAt: Date.now() });
  };

  const handleItemDeleteRequest = (id: string) => {
      if (!trip) return;
      const item = trip.items.find(i => i.id === id);
      if (item?.type === 'city') {
          setDeleteModalState({ isOpen: true, cityId: id });
      } else {
          const newItems = trip.items.filter(item => item.id !== id);
          setTrip({ ...trip, items: newItems, updatedAt: Date.now() });
          setSelectedItemId(null);
      }
  };

  const handleConfirmCityDelete = (strategy: DeleteStrategy, deleteActivities: boolean) => {
      if (!trip || !deleteModalState.cityId) return;
      const cityId = deleteModalState.cityId;
      const cityIndex = trip.items.findIndex(i => i.id === cityId);
      if (cityIndex === -1) return;

      const city = trip.items[cityIndex];
      const items = [...trip.items];
      let finalItems = items.filter(i => i.id !== cityId);
      
      if (deleteActivities) {
          const cityEnd = city.startDateOffset + city.duration;
          finalItems = finalItems.filter(item => {
              if (item.type !== 'activity') return true;
              return !(item.startDateOffset >= city.startDateOffset && item.startDateOffset < cityEnd);
          });
      }

      const sortedCities = finalItems.filter(i => i.type === 'city').sort((a, b) => a.startDateOffset - b.startDateOffset);
      
      if (strategy === 'extend-prev') {
          const prevCity = sortedCities.find(c => c.startDateOffset < city.startDateOffset);
          if (prevCity) {
              const pIndex = finalItems.findIndex(i => i.id === prevCity.id);
              if (pIndex !== -1) {
                  finalItems[pIndex] = { ...finalItems[pIndex], duration: finalItems[pIndex].duration + city.duration };
              }
          }
      } else if (strategy === 'extend-next') {
          const nextCity = sortedCities.find(c => c.startDateOffset > city.startDateOffset);
          if (nextCity) {
              const nIndex = finalItems.findIndex(i => i.id === nextCity.id);
              if (nIndex !== -1) {
                  finalItems[nIndex] = { 
                      ...finalItems[nIndex], 
                      startDateOffset: city.startDateOffset,
                      duration: finalItems[nIndex].duration + city.duration
                  };
              }
          }
      } else if (strategy === 'move-rest') {
          finalItems = finalItems.map(item => {
              if (item.startDateOffset > city.startDateOffset) {
                  return { ...item, startDateOffset: item.startDateOffset - city.duration };
              }
              return item;
          });
      }

      // Cleanup travel
      const cityEnd = city.startDateOffset + city.duration;
      finalItems = finalItems.filter(item => {
          if (item.type !== 'travel' && item.type !== 'travel-empty') return true;
          if (item.startDateOffset >= city.startDateOffset - 0.5 && item.startDateOffset <= cityEnd + 0.5) {
              return false;
          }
          return true;
      });

      // Add gaps
      const reSortedCities = finalItems.filter(i => i.type === 'city').sort((a, b) => a.startDateOffset - b.startDateOffset);
      
      for (let i = 0; i < reSortedCities.length - 1; i++) {
          const c1 = reSortedCities[i];
          const c2 = reSortedCities[i+1];
          const c1End = c1.startDateOffset + c1.duration;
          const hasTravel = finalItems.some(t => (t.type === 'travel' || t.type === 'travel-empty') && t.startDateOffset >= c1End - 0.5 && t.startDateOffset <= c2.startDateOffset + 0.5);
          
          if (!hasTravel) {
               finalItems.push({
                   id: `travel-empty-${Date.now()}-${i}`,
                   type: 'travel-empty',
                   title: 'Add Travel',
                   startDateOffset: c1End - 0.25, 
                   duration: 0.5,
                   color: TRAVEL_EMPTY_COLOR,
                   description: `Travel between ${c1.title} and ${c2.title}`
               });
          }
      }

      setTrip({ ...trip, items: finalItems, updatedAt: Date.now() });
      setDeleteModalState({ isOpen: false, cityId: null });
      setSelectedItemId(null);
  };

  const handleAddCity = (name: string, lat: number, lng: number) => {
    if (!trip) return;
    
    // Find last city end
    const cities = trip.items.filter(i => i.type === 'city').sort((a,b) => a.startDateOffset - b.startDateOffset);
    const lastCity = cities[cities.length - 1];
    const newStart = lastCity ? lastCity.startDateOffset + lastCity.duration : 0;
    
    // Add new city
    const newCity: ITimelineItem = {
        id: `city-${Date.now()}`,
        type: 'city',
        title: name,
        startDateOffset: newStart,
        duration: 2, // Default 2 days
        color: getRandomCityColor(cities.length),
        description: `Trip to ${name}`,
        location: name,
        coordinates: { lat, lng }
    };

    const newItems = [...trip.items, newCity];
    setTrip({ ...trip, items: newItems, updatedAt: Date.now() });
    
    // Optionally focus on the new city
    setSelectedItemId(newCity.id);
  };

  const handleGenerate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!destination.trim()) return;

    setIsGenerating(true);
    setGenerationError(null); // Clear previous errors

    try {
      const prompt = `Plan a ${duration} day trip to ${destination} starting on ${startDate}. Preferences: ${notes}`;
      
      const newTrip = await generateItinerary(prompt, startDate, {
          roundTrip: isRoundTrip,
          numCities: numCities !== '' ? Number(numCities) : undefined,
          specificCities: specificCities.trim(),
          budget,
          pace
      });
      
      const monthStr = new Date(startDate).toLocaleDateString('en-US', { month: 'short' });
      newTrip.title = `${destination} (${monthStr}, ${duration} Days)`;

      setTrip(newTrip);
      saveTrip(newTrip); 
      setSelectedItemId(null);
    } catch (error: any) {
      console.error("Generate Error:", error);
      // Set error state instead of alerting
      setGenerationError(error?.message || "Failed to generate itinerary. Please try again or check your API key.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCreateBlank = () => {
      const now = Date.now();
      const blankTrip: ITrip = {
          id: `trip-blank-${now}`,
          title: "New Adventure",
          startDate: startDate,
          items: [
              {
                  id: `city-start-${now}`,
                  type: 'city',
                  title: destination || 'Start City',
                  startDateOffset: 0,
                  duration: 2,
                  color: getRandomCityColor(0),
                  description: 'Start of your journey',
                  location: destination || 'Anywhere',
                  coordinates: { lat: 48.8566, lng: 2.3522 }
              }
          ],
          createdAt: now,
          updatedAt: now
      };
      setTrip(blankTrip);
      saveTrip(blankTrip); 
  };

  const loadThailandExample = () => {
      try {
        const thailandTrip = createThailandTrip("2025-04-13");
        setTrip(thailandTrip);
        saveTrip(thailandTrip);
      } catch (e) {
        console.error("Failed to load example", e);
        alert("Error loading test data. Check console for schema validation errors.");
      }
  };

  const handleShare = () => {
      if (!trip) return;
      const hash = compressTripToUrl(trip);
      const url = `${window.location.origin}${window.location.pathname}#${hash}`;
      navigator.clipboard.writeText(url).then(() => {
          setShareCopied(true);
          setTimeout(() => setShareCopied(false), 2000);
      });
  };
  
  const handleOpenPrintView = () => {
      if (!trip) return;
      const hash = compressTripToUrl(trip);
      // Switch terminology to "List View" but keep underlying param as print or mode=list if desired. 
      // Keeping 'mode=print' for consistency with existing logic but updating UI text.
      const url = `${window.location.origin}${window.location.pathname}?mode=print#${hash}`;
      window.open(url, '_blank');
  };

  const fillExample = (dest: string, days: number, note: string) => {
      setDestination(dest);
      const end = addDays(new Date(startDate), days).toISOString().split('T')[0];
      setEndDate(end);
      setNotes(note);
  };

  const handleOpenAddActivity = (dayOffset: number) => {
      if (!trip) return;
      const city = trip.items
          .filter(i => i.type === 'city')
          .find(c => c.startDateOffset <= dayOffset && (c.startDateOffset + c.duration) > dayOffset);
      
      const location = city?.location || city?.title || "Unknown Location";
      setAddActivityState({ isOpen: true, dayOffset, location });
  };

  const handleAddActivity = (newItem: Partial<ITimelineItem>) => {
      if (!trip) return;
      const item: ITimelineItem = {
          id: `act-new-${Date.now()}`,
          title: 'New Activity',
          type: 'activity',
          color: 'bg-gray-100',
          duration: 1,
          startDateOffset: 0,
          ...newItem
      } as ITimelineItem;
      
      const newItems = [...trip.items, item];
      setTrip({ ...trip, items: newItems, updatedAt: Date.now() });
      setAddActivityState({ isOpen: false, dayOffset: 0, location: '' });
  };

  const selectedItem = trip?.items.find(i => i.id === selectedItemId) || null;

  // Logic to determine if Details Panel should be Sidebar or Overlay
  // If we are in Vertical Timeline view, we use Sidebar (3rd column).
  const isDetailsSidebar = timelineView === 'vertical';

  if (viewMode === 'print' && trip) {
      return <PrintLayout 
        trip={trip} 
        onUpdateTrip={handleUpdateItems}
        onClose={() => {
           if (window.history.length > 1) window.close();
           setViewMode('planner');
           window.history.replaceState(null, '', window.location.pathname + window.location.hash);
      }} />;
  }

  // --- RENDER ---

  // 1. Show Loading Skeleton if generating
  if (isGenerating) {
      return <LoadingSkeleton />;
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50 text-gray-900 font-sans overflow-hidden">
      
      {/* Global Resize Overlay - catches mouse events anywhere when dragging */}
      {isResizing && (
        <div 
            className="fixed inset-0 z-[9999] bg-transparent select-none"
            style={{ 
                cursor: resizeTarget === 'map' && layoutMode === 'vertical' ? 'row-resize' : 'col-resize' 
            }} 
        />
      )}

      <TripManager isOpen={isManagerOpen} onClose={() => setIsManagerOpen(false)} onSelectTrip={setTrip} currentTripId={trip?.id} />
      <DeleteCityModal isOpen={deleteModalState.isOpen} cityName={trip?.items.find(i => i.id === deleteModalState.cityId)?.title || 'City'} onClose={() => setDeleteModalState({ isOpen: false, cityId: null })} onConfirm={handleConfirmCityDelete} />
      <AddActivityModal isOpen={addActivityState.isOpen} onClose={() => setAddActivityState({ ...addActivityState, isOpen: false })} dayOffset={addActivityState.dayOffset} location={addActivityState.location} onAdd={handleAddActivity} trip={trip} notes={notes} />
      <AddCityModal isOpen={isAddCityModalOpen} onClose={() => setIsAddCityModalOpen(false)} onAdd={handleAddCity} />
      
      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        timelineView={timelineView} 
        onToggleView={setTimelineView} 
      />

      {/* Header */}
      <header className="h-16 bg-white border-b border-gray-200 flex items-center px-6 justify-between flex-shrink-0 z-30 shadow-sm relative no-print sticky top-0">
        <div className="flex items-center space-x-4">
             <button onClick={() => setIsManagerOpen(true)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors flex items-center gap-2"><Folder size={20} /><span className="text-sm font-medium hidden sm:inline">My Plans</span></button>
            <div className="h-6 w-px bg-gray-200 hidden sm:block"></div>
            <div className="flex items-center space-x-2 cursor-pointer" onClick={() => { setTrip(null); setSelectedItemId(null); }}><div className="bg-indigo-600 p-1.5 rounded-lg"><Plane className="text-white h-5 w-5" /></div><h1 className="text-xl font-bold tracking-tight text-gray-800">TravelFlow</h1></div>
        </div>

        {trip && (
            <div className="hidden md:flex items-center space-x-4">
                {isEditingTitle ? (
                    <input type="text" value={editTitleValue} onChange={(e) => setEditTitleValue(e.target.value)} onBlur={handleTitleSave} onKeyDown={handleTitleKeyDown} autoFocus className="text-sm font-medium text-gray-800 bg-white px-3 py-1 rounded-full border border-indigo-300 focus:ring-2 focus:ring-indigo-500 outline-none w-[300px]"/>
                ) : (
                    <div className="group flex items-center gap-2 cursor-pointer" onClick={handleTitleClick}><h2 className="text-sm font-medium text-gray-500 bg-gray-100 px-3 py-1 rounded-full border border-gray-200 max-w-[300px] truncate group-hover:bg-gray-200 group-hover:border-gray-300 transition-all">{trip.title}</h2><Pencil size={14} className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" /></div>
                )}
            </div>
        )}

        <div className="flex items-center gap-2">
            {trip && (
                <>
                 <button onClick={handleOpenPrintView} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all" title="List View (Print)"><List size={18} /> <span className="hidden sm:inline">List View</span></button>
                 <button onClick={() => setIsSettingsOpen(true)} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all"><Settings size={18} /></button>
                 <button onClick={handleShare} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${shareCopied ? 'bg-green-100 text-green-700' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}`}>{shareCopied ? <Check size={16} /> : <Share2 size={16} />}{shareCopied ? 'Link Copied!' : 'Share'}</button>
                </>
            )}
             <button onClick={() => { setTrip(null); setSelectedItemId(null); }} className="text-sm text-gray-500 hover:text-indigo-600 font-medium px-3">New Trip</button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative overflow-hidden" ref={containerRef}>
        {!trip ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 bg-gradient-to-b from-white to-gray-50 overflow-y-auto">
             {/* Generator UI */}
            <div className="w-full max-w-lg space-y-6 text-center mb-8"><h2 className="text-4xl font-extrabold text-gray-900 tracking-tight">Where to next?</h2><p className="text-gray-500 text-lg">Plan your perfect trip with AI-powered timelines.</p></div>
            <div className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100 w-full max-w-lg relative overflow-hidden transition-all"><div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>{generationError && (<div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-start gap-3 animate-in fade-in slide-in-from-top-2"><AlertTriangle size={18} className="mt-0.5 flex-shrink-0" /><div className="flex-1"><span className="font-bold block mb-1">Planning Failed</span>{generationError}</div><button onClick={() => setGenerationError(null)} className="text-red-400 hover:text-red-700"><Check size={16} /></button></div>)}<form className="space-y-5" onSubmit={handleGenerate}><CountrySelect value={destination} onChange={setDestination} disabled={isGenerating} /><div className="space-y-1.5 text-left"><DateRangePicker startDate={startDate} endDate={endDate} onChange={(s, e) => { setStartDate(s); setEndDate(e); }} disabled={isGenerating} /><div className="flex justify-between items-center px-1"><div className="flex items-center gap-2"><input type="checkbox" id="roundtrip" checked={isRoundTrip} onChange={e => setIsRoundTrip(e.target.checked)} className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"/><label htmlFor="roundtrip" className="text-xs font-medium text-gray-500 cursor-pointer select-none">Roundtrip</label></div><div className="text-xs text-gray-400 font-medium">{duration} Days Total</div></div></div><div className="border-t border-gray-100 pt-2"><button type="button" onClick={() => setShowAdvanced(!showAdvanced)} className="flex items-center gap-1.5 text-xs font-bold text-gray-500 uppercase tracking-wider hover:text-indigo-600 transition-colors"><Settings size={14} /> Advanced Options {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</button>{showAdvanced && (<div className="grid grid-cols-2 gap-4 mt-4 animate-in fade-in slide-in-from-top-2"><div className="col-span-2 space-y-1"><label className="text-xs font-medium text-gray-500">Specific Cities (Optional)</label><input type="text" value={specificCities} onChange={e => setSpecificCities(e.target.value)} placeholder="Paris, Lyon, Nice..." className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500 outline-none"/></div><div className="space-y-1"><label className="text-xs font-medium text-gray-500">Budget</label><div className="relative"><Wallet size={14} className="absolute left-2.5 top-2.5 text-gray-400" /><select value={budget} onChange={e => setBudget(e.target.value)} className="w-full pl-8 p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500 outline-none appearance-none"><option>Low</option><option>Medium</option><option>High</option><option>Luxury</option></select></div></div><div className="space-y-1"><label className="text-xs font-medium text-gray-500">Pace</label><div className="relative"><Clock size={14} className="absolute left-2.5 top-2.5 text-gray-400" /><select value={pace} onChange={e => setPace(e.target.value)} className="w-full pl-8 p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500 outline-none appearance-none"><option>Relaxed</option><option>Balanced</option><option>Fast</option></select></div></div><div className="space-y-1"><label className="text-xs font-medium text-gray-500">Stops</label><div className="relative"><MapPin size={14} className="absolute left-2.5 top-2.5 text-gray-400" /><input type="number" min="1" max="20" value={numCities} onChange={e => setNumCities(e.target.value ? Number(e.target.value) : '')} placeholder="Auto" className="w-full pl-8 p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500 outline-none"/></div></div></div>)}</div><div className="space-y-1.5 text-left"><label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5"><AlignLeft size={14} className="text-indigo-500"/> Style & Preferences</label><textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Foodie tour, hiking focus, kid friendly..." className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none h-20 resize-none text-gray-800 placeholder-gray-400 text-sm" disabled={isGenerating}/></div><div className="flex gap-3 pt-2"><button type="submit" disabled={isGenerating || !destination} className="flex-1 py-3.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-0.5">{isGenerating ? (<><Loader2 className="animate-spin h-5 w-5" /> <span>Planning...</span></>) : (<><Sparkles className="fill-white/20 h-5 w-5" /> <span>Auto-Generate</span></>)}</button><button type="button" onClick={handleCreateBlank} disabled={isGenerating} className="w-14 bg-white border border-gray-200 hover:border-gray-300 text-gray-500 hover:text-indigo-600 rounded-xl shadow-sm hover:shadow transition-all flex items-center justify-center disabled:opacity-50" title="Start Blank Itinerary"><FilePlus size={22} /></button></div></form></div><div className="mt-8 flex flex-wrap justify-center gap-3 text-sm text-gray-500"><button type="button" className="px-4 py-2 bg-white border border-gray-200 rounded-full hover:border-indigo-300 hover:text-indigo-600 transition-all shadow-sm" onClick={() => fillExample("Italy", 14, "Rome, Florence, Venice. Art & Food.")}>🇮🇹 2 Weeks in Italy</button><button type="button" className="px-4 py-2 bg-white border border-gray-200 rounded-full hover:border-indigo-300 hover:text-indigo-600 transition-all shadow-sm" onClick={() => fillExample("Japan", 7, "Anime, Tech, and Sushi.")}>🇯🇵 7 Days in Japan</button><button type="button" className="px-4 py-2 bg-white border border-gray-200 rounded-full hover:border-indigo-300 hover:text-indigo-600 transition-all shadow-sm" onClick={loadThailandExample}>🇹🇭 Thailand (Test Plan)</button></div>
          </div>
        ) : (
            // --- MAIN APPLICATION LAYOUT ---
            // Root Flex Container (Top -> Bottom)
            <div className={`flex w-full h-full overflow-hidden ${layoutMode === 'vertical' ? 'flex-col' : 'flex-row'}`}>
                
                {/* --- 1. MAP PANEL --- */}
                {/* Vertical Mode: Map on Top */}
                {layoutMode === 'vertical' && (
                    <div className="relative border-b border-gray-200 bg-gray-100 flex-shrink-0" style={{ height: `${verticalMapHeight}px` }}>
                        <ItineraryMap items={trip.items} selectedItemId={selectedItemId} layoutMode={layoutMode} onLayoutChange={setLayoutMode} />
                        {/* Resizer */}
                        <div 
                            className="absolute bottom-0 left-0 right-0 h-4 -mb-2 cursor-row-resize z-50 flex items-center justify-center hover:opacity-100 opacity-0 transition-opacity" 
                            onMouseDown={startResizingMap} 
                        >
                            <div className="w-12 h-1 bg-white/50 backdrop-blur-sm rounded-full shadow-sm border border-gray-200"></div>
                        </div>
                    </div>
                )}
                
                {/* Horizontal Mode: Map on Right (Actually handled by flex-row order) */}
                
                {/* --- 2. MIDDLE CONTENT (Timeline & Details in Row) --- */}
                <div className="flex-1 flex flex-row overflow-hidden relative" ref={timelineAreaRef}>
                    
                    {/* A. TIMELINE AREA */}
                    <div className="flex-1 flex flex-col min-w-0 bg-white relative">
                        {trip.countryInfo && (
                            <div className="px-8 pt-6 pb-2 shrink-0">
                                <CountryInfo info={trip.countryInfo} />
                            </div>
                        )}
                        
                        <div className="flex-1 relative overflow-hidden">
                            {/* Zoom Controls Overlay */}
                            <div className="absolute right-6 top-6 z-40 bg-white/90 backdrop-blur border border-gray-200 rounded-lg shadow-sm flex items-center p-1">
                                <button onClick={handleZoomOut} className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-gray-800 transition-colors" title="Zoom Out"><ZoomOut size={16} /></button>
                                <span className="w-px h-4 bg-gray-200 mx-1"></span>
                                <button onClick={handleZoomIn} className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-gray-800 transition-colors" title="Zoom In"><ZoomIn size={16} /></button>
                            </div>

                            {timelineView === 'vertical' ? (
                                <VerticalTimeline 
                                    trip={trip}
                                    selectedItemId={selectedItemId}
                                    onSelect={setSelectedItemId}
                                    onUpdateItems={handleUpdateItems}
                                    onForceFill={handleForceFill}
                                    onAddCity={() => setIsAddCityModalOpen(true)}
                                    onAddActivity={handleOpenAddActivity}
                                    pixelsPerDay={pixelsPerDay}
                                />
                            ) : (
                                <Timeline 
                                    trip={trip} 
                                    selectedItemId={selectedItemId} 
                                    onSelect={setSelectedItemId}
                                    onUpdateItems={handleUpdateItems}
                                    onAddActivity={handleOpenAddActivity}
                                    onForceFill={handleForceFill}
                                    onAddCity={() => setIsAddCityModalOpen(true)}
                                    pixelsPerDay={pixelsPerDay}
                                />
                            )}
                        </div>
                    </div>

                    {/* B. SIDEBAR DETAILS PANEL (Only active if timelineView is vertical and item selected) */}
                    {isDetailsSidebar && selectedItemId && trip && (
                        <>
                             {/* Resizer - Improved Hit Area */}
                            <div 
                                className="w-4 -ml-2 h-full cursor-col-resize flex flex-col items-center justify-center hover:bg-indigo-50/30 active:bg-indigo-100 transition-colors group z-[60] flex-shrink-0 relative"
                                onMouseDown={startResizingSidePanel}
                            >
                                {/* Visual Handle Line - Centered */}
                                <div className="absolute inset-y-0 left-1/2 w-px bg-gray-200 group-hover:bg-indigo-300"></div>
                                {/* Visual Grip Pill */}
                                <div className="relative h-8 w-1 bg-gray-300 rounded-full group-hover:bg-indigo-400 transition-colors shadow-sm z-10"></div>
                            </div>
                            
                            {/* Panel Column */}
                            <div className="flex-shrink-0 bg-white h-full overflow-hidden" style={{ width: `${sidePanelWidth}px` }}>
                                <DetailsPanel 
                                    item={selectedItem} 
                                    isOpen={!!selectedItemId}
                                    onClose={() => setSelectedItemId(null)}
                                    onUpdate={handleItemUpdate}
                                    onDelete={handleItemDeleteRequest}
                                    tripStartDate={trip.startDate}
                                    onForceFill={handleForceFill}
                                    variant="sidebar"
                                />
                            </div>
                        </>
                    )}
                </div>

                {/* --- 3. MAP PANEL (Horizontal Layout Position) --- */}
                {layoutMode === 'horizontal' && (
                    <>
                        {/* Resizer */}
                        <div 
                            className="w-4 -ml-2 h-full cursor-col-resize flex flex-col items-center justify-center hover:bg-indigo-50/30 active:bg-indigo-100 transition-colors group z-[60] flex-shrink-0 relative"
                            onMouseDown={startResizingMap}
                        >
                             <div className="absolute inset-y-0 left-1/2 w-px bg-gray-200 group-hover:bg-indigo-300"></div>
                             <div className="relative h-8 w-1 bg-gray-300 rounded-full group-hover:bg-indigo-400 transition-colors shadow-sm z-10"></div>
                        </div>

                        <div className="relative bg-gray-100 flex-shrink-0 h-full" style={{ width: `${horizontalMapWidth}%` }}>
                            <ItineraryMap items={trip.items} selectedItemId={selectedItemId} layoutMode={layoutMode} onLayoutChange={setLayoutMode} />
                        </div>
                    </>
                )}
            </div>
        )}
      </main>

      {/* Legacy Overlay Details Panel (Only if NOT in Sidebar mode) */}
      {!isDetailsSidebar && trip && (
        <DetailsPanel 
            item={selectedItem} 
            isOpen={!!selectedItemId}
            onClose={() => setSelectedItemId(null)}
            onUpdate={handleItemUpdate}
            onDelete={handleItemDeleteRequest}
            tripStartDate={trip.startDate}
            onForceFill={handleForceFill}
            variant="overlay"
        />
      )}
    </div>
  );
};

export default App;