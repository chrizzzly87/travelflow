import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Search, Loader2, AlertTriangle, ArrowRight } from 'lucide-react';
import { useGoogleMaps } from './GoogleMapsLoader';
import { AppModal } from './ui/app-modal';

interface AddCityModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAdd: (name: string, lat: number, lng: number) => void;
}

export const AddCityModal: React.FC<AddCityModalProps> = ({ isOpen, onClose, onAdd }) => {
    const [inputValue, setInputValue] = useState('');
    const [isManualMode, setIsManualMode] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    const inputRef = useRef<HTMLInputElement>(null);
    const autocompleteRef = useRef<any>(null); // google.maps.places.Autocomplete
    const cityInputId = 'add-city-input';
    
    const { isLoaded } = useGoogleMaps();

    const resetModalState = useCallback(() => {
        setInputValue('');
        setError(null);
        setIsManualMode(false);
    }, []);

    const handleClose = useCallback(() => {
        resetModalState();
        onClose();
    }, [onClose, resetModalState]);

    useEffect(() => {
        if (!isOpen || typeof window === 'undefined') return;
        const rafId = window.requestAnimationFrame(() => {
            inputRef.current?.focus();
        });
        return () => {
            window.cancelAnimationFrame(rafId);
        };
    }, [isOpen]);

    // Init Autocomplete
    useEffect(() => {
        if (!isLoaded || !inputRef.current || !window.google?.maps?.places) {
            return;
        }

        try {
            autocompleteRef.current = new window.google.maps.places.Autocomplete(inputRef.current, {
                types: ['(cities)'],
                fields: ['geometry', 'name', 'formatted_address']
            });

            autocompleteRef.current.addListener('place_changed', handlePlaceSelect);
        } catch (e) {
            console.error("Autocomplete Init Error", e);
            setError("Failed to initialize search.");
            setIsManualMode(true);
        }
    }, [isLoaded, isOpen]);

    const handlePlaceSelect = () => {
        const place = autocompleteRef.current?.getPlace();
        if (!place || !place.geometry || !place.geometry.location) {
            return;
        }

        const name = place.name || place.formatted_address?.split(',')[0] || inputValue;
        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        
        onAdd(name, lat, lng);
        handleClose();
    };

    const handleManualSubmit = () => {
        if (inputValue.trim()) {
            onAdd(inputValue.trim(), 48.8566, 2.3522); 
            handleClose();
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') handleClose();
        if (e.key === 'Enter') {
            handleManualSubmit();
        }
    };

    return (
        <AppModal
            isOpen={isOpen}
            onClose={handleClose}
            title="Add New Destination"
            closeLabel="Close add destination dialog"
            size="sm"
            mobileSheet={false}
            bodyClassName="p-6"
            headerClassName="bg-gray-50 p-4"
            onOpenAutoFocus={(event) => {
                event.preventDefault();
                inputRef.current?.focus();
            }}
        >
            <style>{`.pac-container { z-index: 99999 !important; }`}</style>
            
            {error && (
                 <div className="mb-4 flex items-start gap-2 rounded-lg border border-yellow-100 bg-yellow-50 p-3 text-sm text-yellow-700">
                    <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                    <div>{error}</div>
                </div>
            )}
            
            <div className="space-y-4">
                <div>
                    <label htmlFor={cityInputId} className="mb-2 block text-xs font-bold uppercase text-gray-500">
                        {isManualMode ? "City Name" : "Search City"}
                    </label>
                    <div className="relative">
                        <input 
                            id={cityInputId}
                            ref={inputRef}
                            type="text" 
                            value={inputValue}
                            onChange={e => setInputValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-10 pr-4 text-gray-800 outline-none placeholder-gray-400 focus:ring-2 focus:ring-accent-500"
                            placeholder="e.g. Kyoto, Japan"
                        />
                        <div className="absolute left-3 top-3.5 text-gray-400">
                            {!isLoaded && !isManualMode ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                        </div>
                        
                        {isManualMode && (
                            <button 
                                type="button"
                                onClick={handleManualSubmit}
                                className="absolute right-2 top-2 rounded-lg bg-accent-600 p-1.5 text-white transition-colors hover:bg-accent-700"
                                disabled={!inputValue.trim()} aria-label="Add destination"
                            >
                                <ArrowRight size={16} />
                            </button>
                        )}
                    </div>
                    <p className="mt-2 text-xs text-gray-400">
                        {!isLoaded
                            ? "Loading Map services..."
                            : "Start typing to search. Select from the dropdown to add."}
                    </p>
                </div>
            </div>
        </AppModal>
    );
};
