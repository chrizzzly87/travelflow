import React, { useEffect, useRef } from 'react';
import { ITimelineItem } from '../types';
import { Focus, Columns, Rows } from 'lucide-react';
import { getHexFromColorClass } from '../utils';

interface ItineraryMapProps {
    items: ITimelineItem[];
    selectedItemId?: string | null;
    layoutMode?: 'horizontal' | 'vertical';
    onLayoutChange?: (mode: 'horizontal' | 'vertical') => void;
}

export const ItineraryMap: React.FC<ItineraryMapProps> = ({ items, selectedItemId, layoutMode, onLayoutChange }) => {
    const mapRef = useRef<any>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const L = (window as any).L; 

    const cities = items
        .filter(i => i.type === 'city' && i.coordinates)
        .sort((a, b) => a.startDateOffset - b.startDateOffset);

    // --- Resize Observer ---
    useEffect(() => {
        if (!containerRef.current || !mapRef.current) return;
        const observer = new ResizeObserver(() => {
            if (mapRef.current) mapRef.current.invalidateSize();
        });
        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    // --- Map Drawing Logic ---
    useEffect(() => {
        if (!L || !containerRef.current) return;

        // 1. Init Map if needed
        if (!mapRef.current) {
            mapRef.current = L.map(containerRef.current, {
                zoomControl: false,
                attributionControl: false
            }).setView([20, 0], 2);

            L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; OpenStreetMap &copy; CARTO',
                subdomains: 'abcd',
                maxZoom: 19
            }).addTo(mapRef.current);
            
            L.control.zoom({ position: 'bottomright' }).addTo(mapRef.current);
        }

        const map = mapRef.current;
        
        // Clear previous layers
        map.eachLayer((layer: any) => {
            if (!layer._url) map.removeLayer(layer);
        });

        if (cities.length === 0) return;

        const bounds = L.latLngBounds([]);

        // 3. Draw Routes (Simple Straight Lines)
        for (let i = 0; i < cities.length - 1; i++) {
            const fromCity = cities[i];
            const toCity = cities[i+1];
            if (!fromCity.coordinates || !toCity.coordinates) continue;

            const startLatLng: [number, number] = [fromCity.coordinates.lat, fromCity.coordinates.lng];
            const endLatLng: [number, number] = [toCity.coordinates.lat, toCity.coordinates.lng];

            L.polyline([startLatLng, endLatLng], {
                color: '#6366f1', // Indigo-500
                weight: 2,
                dashArray: '6, 8', // Dashed line
                opacity: 0.6
            }).addTo(map);
        }

        // 4. Draw City Markers
        cities.forEach((city, index) => {
            if (!city.coordinates) return;
            const { lat, lng } = city.coordinates;
            const isSelected = city.id === selectedItemId;
            const scale = isSelected ? 1.3 : 1;
            const zIndex = isSelected ? 1000 : 500;
            const hexColor = getHexFromColorClass(city.color);

            const icon = L.divIcon({
                className: 'custom-city-marker',
                html: `<div style="
                    background-color: ${hexColor}; 
                    width: 28px; 
                    height: 28px; 
                    border-radius: 50%; 
                    color: white; 
                    display: flex; 
                    align-items: center; 
                    justify-content: center; 
                    font-weight: 800; 
                    font-size: 13px; 
                    border: 3px solid white; 
                    box-shadow: 0 4px 8px rgba(0,0,0,0.3);
                    transform: scale(${scale});
                    transition: transform 0.2s ease;
                ">${index + 1}</div>`,
                iconSize: [28, 28],
                iconAnchor: [14, 14]
            });

            const m = L.marker([lat, lng], { icon, zIndexOffset: zIndex }).addTo(map);
            
            m.bindTooltip(city.title, { 
                permanent: false, 
                direction: 'bottom', 
                offset: [0, 8],
                className: 'city-tooltip'
            });

            if (isSelected) m.openTooltip();
            bounds.extend([lat, lng]);
        });

        // 5. Fit Bounds
        if (bounds.isValid()) {
            map.fitBounds(bounds, { padding: [50, 50], maxZoom: 8 });
        }

    }, [cities.map(c => c.id).join(','), items, selectedItemId]);

    // Manual Fit Trigger
    const handleFitBounds = () => {
        if (!mapRef.current) return;
        const validCities = items.filter(i => i.type === 'city' && i.coordinates);
        if (validCities.length === 0) return;
        
        const bounds = L.latLngBounds(validCities.map(c => [c.coordinates!.lat, c.coordinates!.lng]));
        mapRef.current.fitBounds(bounds, { padding: [50, 50] });
    };

    return (
        <div className="relative w-full h-full group bg-gray-100">
            <div ref={containerRef} className="w-full h-full z-0" />
            
            {/* Unified Map Controls (Top Right) */}
            <div className="absolute top-4 right-4 z-[400] flex flex-col gap-2">
                {onLayoutChange && (
                    <>
                        <button 
                            onClick={() => onLayoutChange('vertical')}
                            className={`p-2 rounded-lg shadow-md border transition-colors ${layoutMode === 'vertical' ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-white border-gray-200 text-gray-600 hover:text-indigo-600 hover:bg-gray-50'}`}
                            title="Dock Map Top (Rows)"
                        >
                            <Rows size={18} />
                        </button>
                        <button 
                            onClick={() => onLayoutChange('horizontal')}
                            className={`p-2 rounded-lg shadow-md border transition-colors ${layoutMode === 'horizontal' ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-white border-gray-200 text-gray-600 hover:text-indigo-600 hover:bg-gray-50'}`}
                            title="Dock Map Side (Columns)"
                        >
                            <Columns size={18} />
                        </button>
                    </>
                )}
                
                {/* Fit Button (Aligned in same group) */}
                <button 
                    onClick={handleFitBounds}
                    className="p-2 rounded-lg shadow-md border bg-white border-gray-200 text-gray-600 hover:text-indigo-600 hover:bg-gray-50 transition-colors flex items-center justify-center"
                    title="Fit to Itinerary"
                >
                    <Focus size={18} />
                </button>
            </div>
        </div>
    );
};