import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Search, Loader2, AlertTriangle, ArrowRight } from 'lucide-react';
import { useGoogleMaps } from './GoogleMapsLoader';
import { AppModal } from './ui/app-modal';
import { getStoredAppLanguage } from '../utils';
import { resolveCitySuggestion, searchCitySuggestions, type CityLookupSuggestion } from '../services/locationSearchService';

interface AddCityModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAdd: (name: string, lat: number, lng: number) => void;
}

export const AddCityModal: React.FC<AddCityModalProps> = ({ isOpen, onClose, onAdd }) => {
    const [inputValue, setInputValue] = useState('');
    const [isManualMode, setIsManualMode] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isResolvingSelection, setIsResolvingSelection] = useState(false);
    const [suggestions, setSuggestions] = useState<CityLookupSuggestion[]>([]);
    const [isSearchingSuggestions, setIsSearchingSuggestions] = useState(false);
    
    const inputRef = useRef<HTMLInputElement>(null);
    const lookupRequestIdRef = useRef(0);
    const cityInputId = 'add-city-input';
    const mapLanguage = getStoredAppLanguage();
    
    const { isLoaded } = useGoogleMaps();

    const resetModalState = useCallback(() => {
        lookupRequestIdRef.current += 1;
        setInputValue('');
        setError(null);
        setIsManualMode(false);
        setIsResolvingSelection(false);
        setSuggestions([]);
        setIsSearchingSuggestions(false);
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

    useEffect(() => {
        if (!isOpen) {
            setSuggestions([]);
            setIsSearchingSuggestions(false);
            return;
        }

        const query = inputValue.trim();
        if (!isLoaded || query.length < 2) {
            setSuggestions([]);
            setIsSearchingSuggestions(false);
            return;
        }

        const requestId = lookupRequestIdRef.current + 1;
        lookupRequestIdRef.current = requestId;
        setIsSearchingSuggestions(true);

        const timeoutId = window.setTimeout(() => {
            void (async () => {
                const nextSuggestions = await searchCitySuggestions(query, { language: mapLanguage, maxResults: 5 });
                if (lookupRequestIdRef.current !== requestId) return;
                setSuggestions(nextSuggestions);
                setIsSearchingSuggestions(false);
            })();
        }, 220);

        return () => {
            window.clearTimeout(timeoutId);
        };
    }, [inputValue, isLoaded, isOpen, mapLanguage]);

    const handleSuggestionSelect = (suggestion: CityLookupSuggestion) => {
        onAdd(suggestion.name, suggestion.coordinates.lat, suggestion.coordinates.lng);
        handleClose();
    };

    const handleManualSubmit = async () => {
        const query = inputValue.trim();
        if (!query) return;
        if (!isLoaded) {
            setError('Map services are still loading. Please try again in a moment.');
            return;
        }

        setIsResolvingSelection(true);
        setError(null);
        const result = await resolveCitySuggestion(query, { language: mapLanguage });
        setIsResolvingSelection(false);

        if (!result) {
            setError('No matching city found. Try "City, Country" or choose a suggestion.');
            setIsManualMode(true);
            return;
        }

        onAdd(result.name, result.coordinates.lat, result.coordinates.lng);
        handleClose();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') handleClose();
        if (e.key === 'Enter' && !isResolvingSelection) {
            e.preventDefault();
            const firstSuggestion = suggestions[0];
            if (firstSuggestion) {
                handleSuggestionSelect(firstSuggestion);
                return;
            }
            void handleManualSubmit();
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
                            onChange={e => {
                                setInputValue(e.target.value);
                                setError(null);
                                setIsManualMode(false);
                            }}
                            onKeyDown={handleKeyDown}
                            className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-10 pr-4 text-gray-800 outline-none placeholder-gray-400 focus:ring-2 focus:ring-accent-500"
                            placeholder="e.g. Kyoto, Japan"
                        />
                        <div className="absolute left-3 top-3.5 text-gray-400">
                            {!isLoaded || isSearchingSuggestions ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                        </div>
                        
                        {isManualMode && (
                            <button 
                                type="button"
                                onClick={() => void handleManualSubmit()}
                                className="absolute right-2 top-2 rounded-lg bg-accent-600 p-1.5 text-white transition-colors hover:bg-accent-700"
                                disabled={!inputValue.trim() || isResolvingSelection} aria-label="Add destination"
                            >
                                {isResolvingSelection ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                            </button>
                        )}
                    </div>
                    {(isSearchingSuggestions || suggestions.length > 0) && (
                        <div className="mt-2 rounded-lg border border-gray-200 bg-white shadow-sm max-h-44 overflow-y-auto">
                            {isSearchingSuggestions && (
                                <div className="px-3 py-2 text-xs text-gray-500">Searching cities...</div>
                            )}
                            {!isSearchingSuggestions && suggestions.map((suggestion) => (
                                <button
                                    key={suggestion.id}
                                    type="button"
                                    onClick={() => handleSuggestionSelect(suggestion)}
                                    className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                                >
                                    <div className="text-sm font-semibold text-gray-800">{suggestion.name}</div>
                                    <div className="text-xs text-gray-500 truncate">{suggestion.label}</div>
                                </button>
                            ))}
                        </div>
                    )}
                    <p className="mt-2 text-xs text-gray-400">
                        {!isLoaded
                            ? "Loading Map services..."
                            : "Start typing to search and select a city suggestion."}
                    </p>
                </div>
            </div>
        </AppModal>
    );
};
