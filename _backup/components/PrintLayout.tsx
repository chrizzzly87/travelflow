import React from 'react';
import { ITrip, ITimelineItem } from '../types';
import { addDays, formatDate, getTripDuration } from '../utils';
import { MapPin, Calendar, Clock, ArrowRight, Plane, Train, Bus, Ship, Car, Hotel, StickyNote } from 'lucide-react';
import { ItineraryMap } from './ItineraryMap';
import { CountryInfo } from './CountryInfo';
import { MarkdownEditor } from './MarkdownEditor';

interface PrintLayoutProps {
  trip: ITrip;
  onClose: () => void;
  onUpdateTrip: (items: ITimelineItem[]) => void;
}

// Helper to safely parse YYYY-MM-DD to Local Date (avoiding UTC shifts)
const parseLocalDate = (dateStr: string): Date => {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d);
};

// Helper for Legend Dates (e.g. "1. Apr")
const formatLegendDate = (date: Date): string => {
    const day = date.getDate();
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    return `${day}. ${month}`;
};

// Helper to generate calendar grids
const CalendarView: React.FC<{ trip: ITrip; onScrollTo: (id: string) => void }> = ({ trip, onScrollTo }) => {
    const startDate = parseLocalDate(trip.startDate);
    const duration = getTripDuration(trip.items);
    const endDate = addDays(startDate, duration);
    
    // Determine months spanned
    const months: Date[] = [];
    let current = new Date(startDate);
    current.setDate(1); // Start at beginning of month
    
    while (current <= endDate || (current.getMonth() === endDate.getMonth() && current.getFullYear() === endDate.getFullYear())) {
        months.push(new Date(current));
        current.setMonth(current.getMonth() + 1);
    }

    const cities = trip.items.filter(i => i.type === 'city').sort((a,b) => a.startDateOffset - b.startDateOffset);

    // Find all cities overlapping with a specific date
    const getCitiesForDate = (date: Date) => {
        // Use Noon to avoid DST issues when calculating difference
        const tripStart = new Date(startDate);
        tripStart.setHours(12, 0, 0, 0);
        
        const currentCheck = new Date(date);
        currentCheck.setHours(12, 0, 0, 0);

        const diffDays = Math.round((currentCheck.getTime() - tripStart.getTime()) / (1000 * 60 * 60 * 24));
        
        return cities.filter(c => {
            const start = c.startDateOffset;
            const end = c.startDateOffset + c.duration;
            // Check intersection: City interval [start, end) overlaps with Day interval [diffDays, diffDays+1)
            // Intersection exists if start < dayEnd AND end > dayStart
            return start < (diffDays + 1) && end > diffDays;
        }).map(c => ({ item: c, dayIndex: diffDays }));
    };

    return (
        <div className="flex flex-col gap-6 pb-4 w-full">
             {/* Legend */}
             <div className="pt-2">
                 <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3 border-b border-gray-100 pb-2">Trip Legend</h3>
                 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2">
                     {cities.map((city, idx) => {
                         const start = addDays(startDate, city.startDateOffset);
                         const end = addDays(startDate, city.startDateOffset + city.duration);
                         const nights = Number(city.duration.toFixed(1));
                         const days = Math.ceil(city.duration + (city.duration % 1 === 0 ? 1 : 0)); 
                         const shorthand = `${days}D/${nights}N`;
                         
                         const dateStr = `${formatLegendDate(start)} - ${formatLegendDate(end)}`;
                         const bgClass = city.color.split(' ')[0];

                         return (
                             <div 
                                key={city.id} 
                                className="flex items-center gap-2 text-xs cursor-pointer hover:bg-gray-50 p-1 rounded transition-colors"
                                onClick={() => onScrollTo(city.id)}
                             >
                                 <div className={`w-3 h-3 rounded-full flex-shrink-0 ${bgClass}`} />
                                 <div className="flex-1 min-w-0">
                                     <div className="font-bold text-gray-800 truncate">{city.title}</div>
                                     <div className="text-gray-400 flex justify-between">
                                         <span>{dateStr}</span>
                                         <span className="font-mono">{shorthand}</span>
                                     </div>
                                 </div>
                             </div>
                         );
                     })}
                 </div>
             </div>
             
             {/* Months Grid */}
             <div className="flex flex-wrap gap-x-8 gap-y-8">
                {months.map((monthDate, idx) => {
                    const year = monthDate.getFullYear();
                    const month = monthDate.getMonth();
                    const daysInMonth = new Date(year, month + 1, 0).getDate();
                    const firstDayOffset = (new Date(year, month, 1).getDay() + 6) % 7; // Mon=0
                    
                    return (
                        <div key={idx} className="flex-shrink-0 w-64 break-inside-avoid">
                            <h3 className="text-center font-bold text-gray-800 mb-2 uppercase tracking-wider text-sm">
                                {monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                            </h3>
                            <div className="grid grid-cols-7 gap-y-1 gap-x-0 text-center text-xs">
                                {['M','T','W','T','F','S','S'].map((d, i) => (
                                    <div key={i} className={`font-bold mb-1 ${i >= 5 ? 'text-indigo-400' : 'text-gray-400'}`}>{d}</div>
                                ))}
                                {Array.from({ length: firstDayOffset }).map((_, i) => <div key={`empty-${i}`} />)}
                                {Array.from({ length: daysInMonth }).map((_, i) => {
                                    const day = i + 1;
                                    const date = new Date(year, month, day);
                                    
                                    // Get all cities for this day
                                    const activeCities = getCitiesForDate(date);
                                    
                                    // Determine grid position for weekend check (0-6, 5=Sat, 6=Sun)
                                    const colIndex = (firstDayOffset + i) % 7;
                                    const isWeekend = colIndex === 5 || colIndex === 6;

                                    return (
                                        <div 
                                            key={day} 
                                            className={`
                                                aspect-square relative flex items-center justify-center isolate border border-transparent
                                                ${isWeekend ? 'bg-indigo-50/30' : ''}
                                                ${activeCities.length > 0 ? 'cursor-pointer' : ''}
                                            `}
                                            onClick={() => activeCities.length > 0 && onScrollTo(activeCities[0].item.id)}
                                        >
                                            {/* Render Bars for Cities */}
                                            {activeCities.map(({ item, dayIndex }) => {
                                                const bgClass = item.color.split(' ')[0].replace('bg-', 'bg-');
                                                
                                                const cityStart = item.startDateOffset;
                                                const cityEnd = item.startDateOffset + item.duration;
                                                
                                                // Calculate visible range within this day [dayIndex, dayIndex+1]
                                                const visibleStart = Math.max(cityStart, dayIndex);
                                                const visibleEnd = Math.min(cityEnd, dayIndex + 1);
                                                
                                                // Calculate positioning percentages relative to the cell
                                                const leftPct = (visibleStart - dayIndex) * 100;
                                                const widthPct = (visibleEnd - visibleStart) * 100;
                                                
                                                // Rounding logic - minimal rounding for print view for better "block" feel
                                                const isStart = Math.abs(cityStart - visibleStart) < 0.001;
                                                const isEnd = Math.abs(cityEnd - visibleEnd) < 0.001;
                                                const roundedClass = `${isStart ? 'rounded-l-sm' : ''} ${isEnd ? 'rounded-r-sm' : ''}`;

                                                return (
                                                    <div 
                                                        key={item.id}
                                                        className={`absolute top-0 bottom-0 -z-10 ${bgClass} ${roundedClass} opacity-70 print:opacity-60`}
                                                        style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                                                    />
                                                );
                                            })}

                                            {/* Day Number (On Top) */}
                                            <span className={`relative z-10 font-bold ${activeCities.length > 0 ? 'text-gray-900' : (isWeekend ? 'text-gray-600' : 'text-gray-500')}`}>
                                                {day}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
             </div>
        </div>
    );
};

export const PrintLayout: React.FC<PrintLayoutProps> = ({ trip, onClose, onUpdateTrip }) => {
  const tripStartDate = parseLocalDate(trip.startDate);
  const cities = trip.items.filter(i => i.type === 'city').sort((a, b) => a.startDateOffset - b.startDateOffset);

  const handleScrollTo = (cityId: string) => {
      const element = document.getElementById(`city-detail-${cityId}`);
      if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
  };

  const handleUpdateNotes = (cityId: string, text: string) => {
      const newItems = trip.items.map(item => {
          if (item.id === cityId) {
              return { ...item, description: text };
          }
          return item;
      });
      onUpdateTrip(newItems);
  };

  return (
    /* 
      Layout Wrapper:
      - Screen: Fixed, full height, internal scroll.
      - Print: Static, full height (auto), visible overflow to allow browser pagination.
    */
    <div className="fixed inset-0 z-[9999] bg-white text-gray-900 font-sans w-full h-full overflow-y-auto no-scrollbar print:static print:h-auto print:overflow-visible">
        <div className="p-8 max-w-[1400px] mx-auto print:p-0 print:max-w-none print:w-full print:h-auto print:overflow-visible">
            
            {/* Navigation Bar (Hidden on Print) */}
            <div className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 shadow-sm flex items-center justify-between px-8 print:hidden z-50">
                <h1 className="font-bold text-lg text-gray-700">Trip List View</h1>
                <div className="flex gap-4">
                    <button 
                        onClick={onClose} 
                        className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium"
                    >
                        Close
                    </button>
                    <button 
                        onClick={() => window.print()} 
                        className="px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg text-sm font-medium shadow-sm flex items-center gap-2"
                    >
                        Print List
                    </button>
                </div>
            </div>

            <div className="mt-16 print:mt-0 print:h-auto">
                {/* FIRST PAGE LAYOUT (Screen: 100vh-100px, Print: Auto/Page Break) */}
                <section className="break-after-page min-h-[calc(100vh-100px)] flex flex-col w-full print:min-h-0 print:block">
                    {/* Header - Top */}
                    <header className="flex-shrink-0 mb-6 border-b-2 border-gray-900 pb-4 flex justify-between items-end">
                        <div>
                            <h1 className="text-4xl font-extrabold tracking-tight mb-2">{trip.title}</h1>
                            <div className="text-gray-500 font-medium flex gap-4">
                                <span className="flex items-center gap-1"><Calendar size={16}/> {formatDate(tripStartDate)} - {formatDate(addDays(tripStartDate, getTripDuration(trip.items)))}</span>
                                <span className="flex items-center gap-1"><Clock size={16}/> {Math.ceil(getTripDuration(trip.items))} Days</span>
                            </div>
                        </div>
                        <div className="text-right hidden sm:block">
                            <div className="text-sm text-gray-400">Travel Itinerary</div>
                        </div>
                    </header>

                    {/* Content Grid */}
                    <div className="flex-1 min-h-0 grid grid-cols-12 gap-8 w-full print:block">
                        
                        {/* LEFT: Info & Calendar */}
                        <div className="col-span-7 flex flex-col min-h-0 print:w-full print:mb-8">
                             {/* Country Info */}
                            {trip.countryInfo && (
                                <div className="mb-6 flex-shrink-0 break-inside-avoid">
                                    <CountryInfo info={trip.countryInfo} />
                                </div>
                            )}
                            
                            {/* Calendar - Allow full height in print */}
                            <div className="flex-1 overflow-y-auto no-scrollbar print:overflow-visible print:h-auto">
                                <CalendarView trip={trip} onScrollTo={handleScrollTo} />
                            </div>
                        </div>

                        {/* RIGHT: Map */}
                        <div className="col-span-5 h-full bg-gray-100 rounded-xl overflow-hidden border border-gray-200 print:border-0 print:bg-white relative print:w-full print:h-[400px] print:break-inside-avoid">
                             <ItineraryMap items={trip.items} />
                        </div>
                    </div>
                </section>

                {/* Detailed Itinerary (Subsequent Pages) */}
                <div className="space-y-12 pt-8 print:pt-4">
                    {cities.map((city, idx) => {
                        const cityStart = addDays(tripStartDate, city.startDateOffset);
                        const cityEnd = addDays(tripStartDate, city.startDateOffset + city.duration);
                        
                        // Find travel TO this city
                        const arrivalTransport = trip.items.find(i => 
                            (i.type === 'travel' || i.type === 'travel-empty') && 
                            Math.abs((i.startDateOffset + i.duration) - city.startDateOffset) < 0.2
                        );
                        
                        // Find activities
                        const cityActivities = trip.items.filter(i => 
                            i.type === 'activity' && 
                            i.startDateOffset >= city.startDateOffset && 
                            i.startDateOffset < (city.startDateOffset + city.duration)
                        ).sort((a,b) => a.startDateOffset - b.startDateOffset);

                        // Group activities by day
                        const days = [];
                        for(let i=0; i<city.duration; i++) {
                            const dayDate = addDays(cityStart, i);
                            const dayActs = cityActivities.filter(act => 
                                act.startDateOffset >= (city.startDateOffset + i) && 
                                act.startDateOffset < (city.startDateOffset + i + 1)
                            );
                            days.push({ date: dayDate, activities: dayActs });
                        }

                        return (
                            <article 
                                key={city.id} 
                                id={`city-detail-${city.id}`}
                                className="break-inside-avoid pb-8 border-b border-gray-100 last:border-0 scroll-mt-24"
                            >
                                {/* City Header */}
                                <div className="flex items-start justify-between mb-6">
                                    <div>
                                        <div className="flex items-center gap-3 mb-1">
                                            <div className={`w-3 h-3 rounded-full ${city.color.split(' ')[0]}`} />
                                            <h2 className="text-2xl font-bold text-gray-900">{city.title}</h2>
                                        </div>
                                        <div className="text-gray-500 font-medium ml-6">
                                            {formatDate(cityStart)} — {formatDate(cityEnd)} <span className="text-gray-300 mx-2">|</span> {Number(city.duration.toFixed(1))} Nights
                                        </div>
                                    </div>
                                    <div className="text-4xl font-black text-gray-100 select-none">
                                        {(idx + 1).toString().padStart(2, '0')}
                                    </div>
                                </div>

                                <div className="ml-6 grid grid-cols-1 md:grid-cols-3 gap-8">
                                    {/* Left Column: Logistics */}
                                    <div className="md:col-span-1 space-y-6">
                                        {/* Transport IN */}
                                        {arrivalTransport && arrivalTransport.type === 'travel' && (
                                            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                                                    <ArrowRight size={12} /> Arrival
                                                </div>
                                                <div className="font-bold text-gray-800 flex items-center gap-2">
                                                    {arrivalTransport.transportMode === 'plane' && <Plane size={16}/>}
                                                    {arrivalTransport.transportMode === 'train' && <Train size={16}/>}
                                                    {arrivalTransport.title}
                                                </div>
                                                {arrivalTransport.description && <div className="text-xs text-gray-500 mt-1">{arrivalTransport.description}</div>}
                                            </div>
                                        )}

                                        {/* Accommodation */}
                                        {city.hotels && city.hotels.length > 0 ? (
                                            <div className="space-y-4">
                                                {city.hotels.map((hotel, hIdx) => (
                                                    <div key={hIdx} className="border border-gray-200 rounded-lg overflow-hidden">
                                                        <div className="bg-gray-50 p-3 border-b border-gray-100 flex items-center justify-between">
                                                            <div className="font-bold text-sm text-gray-800 flex items-center gap-2">
                                                                <Hotel size={14} className="text-indigo-600"/> {hotel.name}
                                                            </div>
                                                        </div>
                                                        {hotel.address && (
                                                            <div className="p-0">
                                                                <div className="p-3 text-xs text-gray-600 border-b border-gray-100 bg-white">
                                                                    <MapPin size={12} className="inline mr-1 text-gray-400"/> {hotel.address}
                                                                </div>
                                                                {/* Map Preview Iframe */}
                                                                <div className="h-32 w-full bg-gray-100 relative">
                                                                    <iframe
                                                                        width="100%"
                                                                        height="100%"
                                                                        frameBorder="0"
                                                                        style={{ border: 0 }}
                                                                        src={`https://maps.google.com/maps?q=${encodeURIComponent(hotel.address)}&t=&z=13&ie=UTF8&iwloc=&output=embed`}
                                                                        aria-hidden="true"
                                                                        title="Hotel Location"
                                                                    ></iframe>
                                                                    <div className="absolute inset-0 border-2 border-transparent print:border-gray-200 pointer-events-none"></div>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="bg-white border-2 border-dashed border-gray-200 p-4 rounded-lg text-center">
                                                <span className="text-xs text-gray-400 font-medium">Accommodation Details Not Set</span>
                                            </div>
                                        )}

                                        {/* Editable Notes Area */}
                                        <div className="border border-gray-200 rounded-lg p-4 bg-[linear-gradient(white_29px,#eee_30px)] bg-[length:100%_30px] pt-1">
                                            <div className="text-xs text-gray-400 font-bold uppercase mb-1 flex items-center gap-1"><StickyNote size={12}/> Notes</div>
                                            <MarkdownEditor 
                                                value={city.description || ''} 
                                                onChange={(val) => handleUpdateNotes(city.id, val)}
                                                className="border-none shadow-none bg-transparent"
                                            />
                                        </div>
                                    </div>

                                    {/* Right Column: Daily Activities */}
                                    <div className="md:col-span-2 space-y-6">
                                        {days.map((day, dIdx) => {
                                            const globalDayIndex = Math.round((day.date.getTime() - tripStartDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                                            
                                            return (
                                                <div key={dIdx} className="relative pl-6 border-l-2 border-gray-100 pb-2 last:pb-0">
                                                    <div className="absolute -left-[5px] top-0 w-2.5 h-2.5 rounded-full bg-gray-300 ring-4 ring-white" />
                                                    <h4 className="font-bold text-gray-900 text-sm mb-3">
                                                        Day {globalDayIndex} <span className="text-gray-400 font-normal mx-1">•</span> {day.date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                                                    </h4>
                                                    
                                                    {day.activities.length > 0 ? (
                                                        <div className="space-y-3">
                                                            {day.activities.map(act => (
                                                                <div key={act.id} className="bg-white rounded-lg p-3 border border-gray-100 shadow-sm flex gap-3">
                                                                    <div className="flex-1">
                                                                        <div className="font-bold text-sm text-gray-800">{act.title}</div>
                                                                        {act.description && <div className="text-xs text-gray-500 mt-1 line-clamp-2">{act.description}</div>}
                                                                        {act.aiInsights && (
                                                                            <div className="mt-2 flex flex-wrap gap-2">
                                                                                {act.aiInsights.bestTime && <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">🕒 {act.aiInsights.bestTime}</span>}
                                                                                {act.aiInsights.cost && <span className="text-[10px] bg-green-50 text-green-600 px-1.5 py-0.5 rounded">💰 {act.aiInsights.cost}</span>}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <div className="text-xs text-gray-400 italic py-2">Free day / No activities planned</div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </article>
                        );
                    })}
                </div>
                
                <footer className="mt-12 pt-8 border-t border-gray-200 text-center text-xs text-gray-400 break-before-page">
                    Created with TravelFlow
                </footer>
            </div>
        </div>
    </div>
  );
};