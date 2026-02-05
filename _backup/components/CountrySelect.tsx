import React, { useState, useRef, useEffect } from 'react';
import { COUNTRIES } from '../utils';
import { MapPin, Search, X, Plus } from 'lucide-react';

interface CountrySelectProps {
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
}

export const CountrySelect: React.FC<CountrySelectProps> = ({ value, onChange, disabled }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const wrapperRef = useRef<HTMLDivElement>(null);

    // Parse existing value into array (comma separated)
    const selectedCountries = value ? value.split(',').map(s => s.trim()).filter(Boolean) : [];

    const filtered = COUNTRIES.filter(c => 
        c.name.toLowerCase().includes(search.toLowerCase()) && 
        !selectedCountries.includes(c.name)
    );

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
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
        // Keep open for adding more if needed, or close? Let's keep input focused but clear search
        // setIsOpen(false); 
    };

    const removeCountry = (name: string) => {
        const newCountries = selectedCountries.filter(c => c !== name);
        onChange(newCountries.join(', '));
    };

    return (
        <div className="relative" ref={wrapperRef}>
             <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                <MapPin size={14} className="text-indigo-500"/> Destination(s)
            </label>
            
            <div 
                className={`w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus-within:ring-2 focus-within:ring-indigo-500 focus-within:bg-white transition-all flex flex-wrap items-center gap-2 cursor-text min-h-[3rem] ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
                onClick={() => { if(!disabled) setIsOpen(true); }}
            >
                {/* Selected Tags */}
                {selectedCountries.map((countryName) => {
                    const countryData = COUNTRIES.find(c => c.name === countryName);
                    return (
                        <span key={countryName} className="flex items-center gap-1 bg-white border border-gray-200 px-2 py-1 rounded-lg text-sm font-medium text-gray-800 shadow-sm animate-in fade-in zoom-in duration-200">
                            <span>{countryData?.flag || '🌍'}</span>
                            <span>{countryName}</span>
                            {!disabled && (
                                <button 
                                    onClick={(e) => { e.stopPropagation(); removeCountry(countryName); }}
                                    className="ml-1 p-0.5 hover:bg-red-50 hover:text-red-500 rounded-full transition-colors"
                                >
                                    <X size={12} />
                                </button>
                            )}
                        </span>
                    );
                })}

                {/* Input */}
                <div className="flex-1 min-w-[120px] flex items-center gap-2">
                    {selectedCountries.length === 0 && <Search size={16} className="text-gray-400" />}
                    <input 
                        type="text"
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setIsOpen(true); }}
                        placeholder={selectedCountries.length === 0 ? "Search countries..." : "Add another..."}
                        className="bg-transparent border-none outline-none w-full text-gray-800 font-medium placeholder-gray-400 text-sm h-8"
                        onFocus={() => setIsOpen(true)}
                    />
                </div>
            </div>

            {/* Dropdown */}
            {isOpen && (search || filtered.length > 0) && (
                <div className="absolute z-50 left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-100 max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200">
                    {filtered.length > 0 ? filtered.map(country => (
                        <div 
                            key={country.code}
                            className="px-4 py-3 hover:bg-gray-50 cursor-pointer flex items-center justify-between transition-colors group"
                            onClick={() => addCountry(country.name)}
                        >
                            <div className="flex items-center gap-3">
                                <span className="text-2xl">{country.flag}</span>
                                <span className="font-medium text-gray-700">{country.name}</span>
                            </div>
                            <Plus size={16} className="text-gray-300 group-hover:text-indigo-500" />
                        </div>
                    )) : (
                        <div className="p-4 text-center text-gray-400 text-sm">
                            {search ? "No matching countries" : "Type to search"}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};