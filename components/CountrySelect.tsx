import React, { useState, useRef, useEffect, useCallback, useId } from 'react';
import {
    getDestinationMetaLabel,
    getDestinationOptionByName,
    getDestinationSeasonCountryName,
    resolveDestinationName,
    searchDestinationOptions,
} from '../services/destinationService';
import { MapPin, Search, Plus } from 'lucide-react';
import { CountryTag } from './CountryTag';
import { IdealTravelTimeline } from './IdealTravelTimeline';
import { getCountrySeasonByName } from '../data/countryTravelData';
import { FlagIcon } from './flags/FlagIcon';
import { getAnalyticsDebugAttributes, trackEvent } from '../services/analyticsService';

interface CountrySelectProps {
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
    recommendationMonths?: number[];
    analyticsEventName?: string;
    labels?: {
        fieldLabel?: string;
        placeholder?: string;
        addAnotherPlaceholder?: string;
        idealTravelTime?: string;
        islandOf?: (country: string) => string;
        noMatches?: string;
        typeToSearch?: string;
    };
}

export const CountrySelect: React.FC<CountrySelectProps> = ({
    value,
    onChange,
    disabled,
    recommendationMonths,
    analyticsEventName,
    labels,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const wrapperRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const searchInputId = useId();

    // Parse existing value into array (comma separated)
    const selectedCountries = value
        ? value.split(',').map((item) => resolveDestinationName(item)).filter(Boolean)
        : [];

    const normalizedSearch = search.trim();
    const filtered = searchDestinationOptions(search, {
        excludeNames: selectedCountries,
        limit: normalizedSearch ? 30 : 20,
        months: recommendationMonths,
    });

    const openDropdown = useCallback(() => {
        if (disabled) return;
        setIsOpen(true);
    }, [disabled]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            if (!wrapperRef.current?.contains(target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const addCountry = (name: string) => {
        const newCountries = [...selectedCountries, name];
        onChange(newCountries.join(', '));
        setSearch('');
        searchInputRef.current?.focus();
    };

    const removeCountry = (name: string) => {
        const newCountries = selectedCountries.filter(c => c !== name);
        onChange(newCountries.join(', '));
    };

    return (
        <div className="relative" ref={wrapperRef}>
             <label htmlFor={searchInputId} className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                <MapPin size={14} className="text-accent-500"/> {labels?.fieldLabel || 'Destination(s)'}
            </label>
            
            <div 
                className={`w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus-within:ring-2 focus-within:ring-accent-500 focus-within:bg-white transition-all flex flex-wrap items-center gap-2 cursor-text min-h-[3rem] ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
            >
                {/* Selected Tags */}
                {selectedCountries.map((countryName) => {
                    const destination = getDestinationOptionByName(countryName);
                    const season = getCountrySeasonByName(getDestinationSeasonCountryName(countryName));
                    const metaLabel = getDestinationMetaLabel(countryName);
                    return (
                        <span key={countryName} className="animate-in fade-in zoom-in duration-200 group relative">
                            <CountryTag
                                countryName={countryName}
                                flag={destination?.flag || '🌍'}
                                metaLabel={metaLabel}
                                removable={!disabled}
                                onRemove={() => removeCountry(countryName)}
                            />
                            {season && (
                                <div className="pointer-events-none absolute left-0 top-[calc(100%+8px)] z-[80] hidden w-[280px] rounded-xl border border-gray-200 bg-white p-3 shadow-xl group-hover:block">
                                    <div className="text-xs font-semibold text-gray-900">{labels?.idealTravelTime || 'Ideal travel time'}</div>
                                    <IdealTravelTimeline idealMonths={season.bestMonths} shoulderMonths={season.shoulderMonths} />
                                </div>
                            )}
                        </span>
                    );
                })}

                {/* Input */}
                <div className="tf-ios-zoom-safe-shell flex-1 min-w-[120px] flex items-center gap-2">
                    {selectedCountries.length === 0 && <Search size={16} className="text-gray-400" />}
                    <input 
                        id={searchInputId}
                        ref={searchInputRef}
                        type="text"
                        value={search}
                        onChange={(e) => {
                            setSearch(e.target.value);
                            openDropdown();
                        }}
                        placeholder={selectedCountries.length === 0
                            ? (labels?.placeholder || 'Search countries or islands...')
                            : (labels?.addAnotherPlaceholder || 'Add another destination...')}
                        className="tf-ios-zoom-safe-field bg-transparent border-none outline-none w-full text-gray-800 font-medium placeholder-gray-400 text-sm h-8"
                        onFocus={openDropdown}
                    />
                </div>
            </div>

            {/* Dropdown */}
            {isOpen && (normalizedSearch || filtered.length > 0) && (
                <div
                    className="absolute inset-x-0 top-[calc(100%+8px)] z-50 max-h-60 overflow-y-auto rounded-xl border border-gray-100 bg-white shadow-xl animate-in fade-in slide-in-from-top-2 duration-200"
                >
                    {filtered.length > 0 ? filtered.map((country) => (
                        <button
                            key={country.code}
                            type="button"
                            className="w-full px-4 py-3 hover:bg-gray-50 cursor-pointer flex items-center justify-between transition-colors group text-left"
                            onClick={() => {
                                if (!normalizedSearch && analyticsEventName) {
                                    trackEvent(analyticsEventName, {
                                        destination_code: country.code,
                                        destination_name: country.name,
                                        destination_kind: country.kind,
                                        source: 'empty_state',
                                        months: (recommendationMonths || []).join(','),
                                    });
                                }
                                addCountry(country.name);
                            }}
                            {...(!normalizedSearch && analyticsEventName
                                ? getAnalyticsDebugAttributes(analyticsEventName, {
                                    destination_code: country.code,
                                    destination_name: country.name,
                                    destination_kind: country.kind,
                                    source: 'empty_state',
                                    months: (recommendationMonths || []).join(','),
                                })
                                : {})}
                        >
                            <div className="flex items-start gap-3 min-w-0">
                                <FlagIcon value={country.flag} size="xl" />
                                <div className="min-w-0">
                                    <div className="font-medium text-gray-700 truncate">{country.name}</div>
                                    {country.kind === 'island' && country.parentCountryName && (
                                        <div className="text-xs text-gray-500 truncate">
                                            {labels?.islandOf ? labels.islandOf(country.parentCountryName) : `Island of ${country.parentCountryName}`}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <Plus size={16} className="text-gray-300 group-hover:text-accent-500" />
                        </button>
                    )) : (
                        <div className="p-4 text-center text-gray-400 text-sm">
                            {search ? (labels?.noMatches || 'No matching destinations') : (labels?.typeToSearch || 'Type to search')}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
