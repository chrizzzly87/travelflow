import React, { useEffect, useState } from 'react';
import { Loader2, Sparkles, FilePlus, Settings, ChevronUp, ChevronDown, Wallet, Clock, MapPin, AlignLeft, Check, AlertTriangle, Folder, Plane } from 'lucide-react';
import { CountrySelect } from './CountrySelect';
import { DateRangePicker } from './DateRangePicker';
import { generateItinerary } from '../services/geminiService';
import { ITimelineItem, ITrip } from '../types';
import { getDefaultTripDates, addDays, generateTripId } from '../utils';
import { createThailandTrip } from '../data/exampleTrips';
import { TripView } from './TripView';
import { TripGenerationSkeleton } from './TripGenerationSkeleton';
import { HeroWebGLBackground } from './HeroWebGLBackground';

interface CreateTripFormProps {
    onTripGenerated: (trip: ITrip) => void;
    onOpenManager: () => void;
}

const GENERATION_MESSAGES = [
    "Analyzing your travel preferences...",
    "Scouting top-rated cities and stops...",
    "Calculating optimal travel routes...",
    "Structuring your daily timeline...",
    "Finalizing logistics and details..."
];
const NOOP = () => {};

export const CreateTripForm: React.FC<CreateTripFormProps> = ({ onTripGenerated, onOpenManager }) => {
    // Generation Form State
    const [destination, setDestination] = useState('');
    const [startDate, setStartDate] = useState(getDefaultTripDates().startDate); 
    const [endDate, setEndDate] = useState(getDefaultTripDates().endDate); 
    const [isRoundTrip, setIsRoundTrip] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);
    const [generationError, setGenerationError] = useState<string | null>(null);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [specificCities, setSpecificCities] = useState('');
    const [budget, setBudget] = useState('Medium');
    const [pace, setPace] = useState('Balanced');
    const [numCities, setNumCities] = useState<number | ''>('');
    const [notes, setNotes] = useState('');
    const [previewTrip, setPreviewTrip] = useState<ITrip | null>(null);
    const [loadingMessage, setLoadingMessage] = useState(GENERATION_MESSAGES[0]);

    const duration = Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const selectedCountries = destination.split(',').map(s => s.trim()).filter(Boolean);
    const primaryCountry = selectedCountries[0];

    const formatDateRange = (start: string, end: string) => {
        const s = new Date(`${start}T00:00:00`);
        const e = new Date(`${end}T00:00:00`);
        const fmt: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
        return `${s.toLocaleDateString(undefined, fmt)} - ${e.toLocaleDateString(undefined, fmt)}`;
    };

    const buildPreviewTrip = (): ITrip => {
        const now = Date.now();
        const totalDays = Math.max(1, duration);
        const requestedCityCount = typeof numCities === 'number' ? Math.max(1, Math.round(numCities)) : Math.min(4, Math.max(2, Math.round(totalDays / 4)));
        const cityCount = Math.max(1, Math.min(requestedCityCount, totalDays));
        const baseDuration = Math.floor(totalDays / cityCount);
        const remainder = totalDays % cityCount;

        let offset = 0;
        const items: ITimelineItem[] = Array.from({ length: cityCount }).map((_, index) => {
            const cityDuration = baseDuration + (index < remainder ? 1 : 0);
            const item: ITimelineItem = {
                id: `loading-city-${index}-${now}`,
                type: 'city',
                title: `Loading stop ${index + 1}`,
                startDateOffset: offset,
                duration: cityDuration,
                color: 'bg-slate-100 border-slate-200 text-slate-400',
                description: 'AI is generating this part of your itinerary.',
                location: primaryCountry || destination || 'Destination',
                loading: true
            };
            offset += cityDuration;
            return item;
        });

        return {
            id: `trip-preview-${now}`,
            title: `Planning ${primaryCountry || destination || 'Trip'}...`,
            startDate,
            items,
            countryInfo: undefined,
            createdAt: now,
            updatedAt: now,
            isFavorite: false
        };
    };

    useEffect(() => {
        if (!isGenerating) return;
        setLoadingMessage(GENERATION_MESSAGES[0]);

        let i = 1;
        const interval = setInterval(() => {
            setLoadingMessage(GENERATION_MESSAGES[i % GENERATION_MESSAGES.length]);
            i += 1;
        }, 2200);

        return () => clearInterval(interval);
    }, [isGenerating]);

    const handleGenerate = async (e: React.FormEvent) => {
        e.preventDefault();
        setPreviewTrip(buildPreviewTrip());
        setIsGenerating(true);
        setGenerationError(null);

        try {
            const trip = await generateItinerary(
                destination, 
                startDate,
                {
                    budget,
                    pace,
                    interests: notes.split(',').map(s => s.trim()).filter(Boolean),
                    specificCities: specificCities,
                    roundTrip: isRoundTrip,
                    totalDays: duration,
                    numCities: typeof numCities === 'number' ? numCities : undefined
                }
            );
            setPreviewTrip(null);
            onTripGenerated(trip);
        } catch (error: any) {
            console.error("Generation failed:", error);
            setPreviewTrip(null);
            setGenerationError(error.message || "Failed to generate itinerary.");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleCreateBlank = () => {
         const blankTrip: ITrip = {
             id: generateTripId(),
             title: `Trip to ${destination || 'Unknown'}`,
             startDate: startDate,
             items: [],
             countryInfo: undefined,
             createdAt: Date.now(),
             updatedAt: Date.now(),
             isFavorite: false
         };
         onTripGenerated(blankTrip);
    };

    const fillExample = (dest: string, days: number, noteText: string) => {
        setDestination(dest);
        const start = new Date();
        const end = addDays(start, days);
        setStartDate(start.toISOString().split('T')[0]);
        setEndDate(end.toISOString().split('T')[0]);
        setNotes(noteText);
    };

    if (isGenerating && previewTrip) {
        return (
            <div className="relative h-screen w-screen">
                <TripView
                    trip={previewTrip}
                    onUpdateTrip={setPreviewTrip}
                    onOpenManager={onOpenManager}
                    onOpenSettings={NOOP}
                    onViewSettingsChange={NOOP}
                    canShare={false}
                    initialMapFocusQuery={primaryCountry}
                />
                <div className="pointer-events-none absolute inset-0 z-[1800] flex items-center justify-center p-4 sm:p-6">
                    <div className="w-full max-w-xl rounded-2xl border border-indigo-100 bg-white/95 shadow-xl backdrop-blur-sm px-5 py-4">
                        <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                                <Loader2 size={18} className="animate-spin" />
                            </div>
                            <div className="min-w-0">
                                <div className="text-sm font-semibold text-indigo-900 truncate">Planning Your Trip</div>
                                <div className="text-xs text-gray-600 truncate">{loadingMessage}</div>
                            </div>
                        </div>
                        <div className="mt-3 text-xs text-gray-500">
                            {(primaryCountry || destination || 'Destination')} • {formatDateRange(startDate, endDate)} • {duration} days
                        </div>
                        <div className="mt-3 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                            <div className="h-full w-1/2 bg-gradient-to-r from-indigo-500 to-blue-500 animate-pulse rounded-full" />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (isGenerating) {
        return <TripGenerationSkeleton />;
    }

  return (
      <div className="w-full h-full flex flex-col relative overflow-hidden bg-slate-50">
           <HeroWebGLBackground className="z-0" />
           <div className="pointer-events-none absolute inset-0 z-[1] bg-white/35" />
           <div className="pointer-events-none absolute -left-24 top-20 z-[1] h-72 w-72 rounded-full bg-cyan-200/30 blur-3xl" />
           <div className="pointer-events-none absolute -right-10 bottom-20 z-[1] h-80 w-80 rounded-full bg-indigo-300/30 blur-3xl" />
           {/* Navigation Header */}
           <header className="absolute top-0 left-0 w-full p-4 sm:p-6 flex justify-between items-center z-20">
               <div className="flex items-center gap-2">
                   <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-indigo-200 shadow-lg transform rotate-3">
                       <Plane className="text-white transform -rotate-3" size={18} fill="currentColor" />
                   </div>
                   <span className="font-bold text-xl tracking-tight text-gray-900 hidden sm:block">Travel<span className="text-indigo-600">Flow</span></span>
               </div>
               <button 
                   onClick={onOpenManager}
                   className="flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur border border-gray-200 hover:border-indigo-300 hover:text-indigo-600 rounded-full shadow-sm hover:shadow transition-all text-sm font-medium text-gray-600"
               >
                   <Folder size={16} />
                   <span>My Trips</span>
               </button>
           </header>

           <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-4 overflow-y-auto w-full">
               <div className="text-center mb-8 mt-12">
                   <h1 className="text-4xl font-extrabold text-gray-900 mb-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Plan your next adventure</h1>
                   <p className="text-gray-500">AI-powered itinerary generation in seconds.</p>
               </div>

           <div className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100 w-full max-w-lg relative overflow-hidden transition-all">
               <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>
                {generationError && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                        <AlertTriangle size={18} className="mt-0.5 flex-shrink-0" />
                        <div className="flex-1"><span className="font-bold block mb-1">Planning Failed</span>{generationError}</div>
                        <button onClick={() => setGenerationError(null)} className="text-red-400 hover:text-red-700"><Check size={16} /></button>
                    </div>
                )}
                <form className="space-y-5" onSubmit={handleGenerate}>
                    <CountrySelect value={destination} onChange={setDestination} disabled={isGenerating} />
                    <div className="space-y-1.5 text-left">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Route</label>
                        <div className="flex items-center gap-2 px-1">
                            <input type="checkbox" id="roundtrip" checked={isRoundTrip} onChange={e => setIsRoundTrip(e.target.checked)} className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"/>
                            <label htmlFor="roundtrip" className="text-sm font-medium text-gray-600 cursor-pointer select-none">Roundtrip (end where you start)</label>
                        </div>
                    </div>
                    <div className="space-y-1.5 text-left">
                        <DateRangePicker startDate={startDate} endDate={endDate} onChange={(s, e) => { setStartDate(s); setEndDate(e); }} disabled={isGenerating} />
                        <div className="flex justify-end items-center px-1">
                            <div className="text-xs text-gray-400 font-medium">{duration} Days Total</div>
                        </div>
                    </div>
                    <div className="border-t border-gray-100 pt-2">
                        <button type="button" onClick={() => setShowAdvanced(!showAdvanced)} className="flex items-center gap-1.5 text-xs font-bold text-gray-500 uppercase tracking-wider hover:text-indigo-600 transition-colors">
                            <Settings size={14} /> Advanced Options {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                        {showAdvanced && (
                            <div className="grid grid-cols-2 gap-4 mt-4 animate-in fade-in slide-in-from-top-2">
                                <div className="col-span-2 space-y-1">
                                    <label className="text-xs font-medium text-gray-500">Specific Cities (Optional)</label>
                                    <input type="text" value={specificCities} onChange={e => setSpecificCities(e.target.value)} placeholder="Paris, Lyon, Nice..." className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500 outline-none"/>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-gray-500">Budget</label>
                                    <div className="relative">
                                        <Wallet size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
                                        <select value={budget} onChange={e => setBudget(e.target.value)} className="w-full pl-8 p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500 outline-none appearance-none">
                                            <option>Low</option><option>Medium</option><option>High</option><option>Luxury</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-gray-500">Pace</label>
                                    <div className="relative">
                                        <Clock size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
                                        <select value={pace} onChange={e => setPace(e.target.value)} className="w-full pl-8 p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500 outline-none appearance-none">
                                            <option>Relaxed</option><option>Balanced</option><option>Fast</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-gray-500">Stops</label>
                                    <div className="relative">
                                        <MapPin size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
                                        <input type="number" min="1" max="20" value={numCities} onChange={e => setNumCities(e.target.value ? Number(e.target.value) : '')} placeholder="Auto" className="w-full pl-8 p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500 outline-none"/>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="space-y-1.5 text-left">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5"><AlignLeft size={14} className="text-indigo-500"/> Style & Preferences</label>
                        <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Foodie tour, hiking focus, kid friendly..." className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none h-20 resize-none text-gray-800 placeholder-gray-400 text-sm" disabled={isGenerating}/>
                    </div>
                    <div className="flex gap-3 pt-2">
                        <button type="submit" disabled={isGenerating || !destination} className="flex-1 py-3.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-0.5">
                            {isGenerating ? (<><Loader2 className="animate-spin h-5 w-5" /> <span>Planning...</span></>) : (<><Sparkles className="fill-white/20 h-5 w-5" /> <span>Auto-Generate</span></>)}
                        </button>
                        <button type="button" onClick={handleCreateBlank} disabled={isGenerating} className="w-14 bg-white border border-gray-200 hover:border-gray-300 text-gray-500 hover:text-indigo-600 rounded-xl shadow-sm hover:shadow transition-all flex items-center justify-center disabled:opacity-50" title="Start Blank Itinerary"><FilePlus size={22} /></button>
                    </div>
                </form>
           </div>
           
           <div className="mt-8 flex flex-wrap justify-center gap-3 text-sm text-gray-500">
               <button type="button" className="px-4 py-2 bg-white border border-gray-200 rounded-full hover:border-indigo-300 hover:text-indigo-600 transition-all shadow-sm" onClick={() => fillExample("Italy", 14, "Rome, Florence, Venice. Art & Food.")}>🇮🇹 2 Weeks in Italy</button>
               <button type="button" className="px-4 py-2 bg-white border border-gray-200 rounded-full hover:border-indigo-300 hover:text-indigo-600 transition-all shadow-sm" onClick={() => fillExample("Japan", 7, "Anime, Tech, and Sushi.")}>🇯🇵 7 Days in Japan</button>
                <button type="button" className="px-4 py-2 bg-white border border-gray-200 rounded-full hover:border-indigo-300 hover:text-indigo-600 transition-all shadow-sm" onClick={() => onTripGenerated(createThailandTrip(new Date().toISOString()))}>🇹🇭 Thailand (Test Plan)</button>
           </div>
           </div>
      </div>
  );
};
