import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X, MapPin, Search, Loader2, AlertTriangle, ArrowRight } from 'lucide-react';
import { useGoogleMaps } from './GoogleMapsLoader';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface AddCityModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAdd: (name: string, lat: number, lng: number) => void;
}

export const AddCityModal: React.FC<AddCityModalProps> = ({ isOpen, onClose, onAdd }) => {
    const [inputValue, setInputValue] = useState('');
    const [isManualMode, setIsManualMode] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    const dialogRef = useRef<HTMLDivElement | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const autocompleteRef = useRef<any>(null); // google.maps.places.Autocomplete
    const cityInputId = 'add-city-input';
    
    const { isLoaded } = useGoogleMaps();

    useFocusTrap({
        isActive: isOpen,
        containerRef: dialogRef,
        initialFocusRef: inputRef,
    });

    const resetModalState = useCallback(() => {
        setInputValue('');
        setError(null);
        setIsManualMode(false);
    }, []);

    const handleClose = useCallback(() => {
        resetModalState();
        onClose();
    }, [onClose, resetModalState]);

    // Handle Esc Key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (isOpen && e.key === 'Escape') {
                handleClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleClose, isOpen]);

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

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[1300] flex items-center justify-center p-4">
            <button
                type="button"
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={handleClose}
                aria-label="Close add destination dialog"
            />
            <style>{`.pac-container { z-index: 99999 !important; }`}</style>
            
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="add-city-title"
                className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200"
            >
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h3 id="add-city-title" className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        <MapPin size={20} className="text-accent-600" />
                        Add New Destination
                    </h3>
                    <button
                        type="button"
                        onClick={handleClose}
                        className="p-1 hover:bg-gray-200 rounded-full text-gray-500" aria-label="Close"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6">
                    {error && (
                         <div className="p-3 bg-yellow-50 border border-yellow-100 rounded-lg text-sm text-yellow-700 flex items-start gap-2 mb-4">
                            <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                            <div>{error}</div>
                        </div>
                    )}
                    
                    <div className="space-y-4">
                        <div>
                            <label htmlFor={cityInputId} className="block text-xs font-bold text-gray-500 uppercase mb-2">
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
                                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-accent-500 outline-none text-gray-800 placeholder-gray-400"
                                    placeholder="e.g. Kyoto, Japan"
                                />
                                <div className="absolute left-3 top-3.5 text-gray-400">
                                    {!isLoaded && !isManualMode ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                                </div>
                                
                                {isManualMode && (
                                    <button 
                                        type="button"
                                        onClick={handleManualSubmit}
                                        className="absolute right-2 top-2 p-1.5 bg-accent-600 text-white rounded-lg hover:bg-accent-700 transition-colors"
                                        disabled={!inputValue.trim()} aria-label="Add destination"
                                    >
                                        <ArrowRight size={16} />
                                    </button>
                                )}
                            </div>
                            <p className="text-xs text-gray-400 mt-2">
                                {!isLoaded
                                    ? "Loading Map services..."
                                    : "Start typing to search. Select from the dropdown to add."}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
