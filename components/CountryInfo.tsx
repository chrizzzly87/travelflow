import React, { useState, useEffect } from 'react';
import { ICountryInfo } from '../types';
import { Banknote, Globe, Zap, FileText, ExternalLink, ArrowRightLeft } from 'lucide-react';

interface CountryInfoProps {
    info: ICountryInfo;
}

export const CountryInfo: React.FC<CountryInfoProps> = ({ info }) => {
    // Converter State with Persistence
    const [amount, setAmount] = useState<number>(() => {
        if (typeof window === 'undefined') return 1;
        const saved = localStorage.getItem('tf_country_amount');
        const parsed = saved ? parseFloat(saved) : 1;
        return isNaN(parsed) ? 1 : parsed;
    });

    const [direction, setDirection] = useState<'eurToLocal' | 'localToEur'>(() => {
        if (typeof window === 'undefined') return 'eurToLocal';
        const saved = localStorage.getItem('tf_country_dir');
        return (saved === 'eurToLocal' || saved === 'localToEur') ? saved : 'eurToLocal';
    });

    // Persistence Effects
    useEffect(() => {
        localStorage.setItem('tf_country_amount', amount.toString());
    }, [amount]);

    useEffect(() => {
        localStorage.setItem('tf_country_dir', direction);
    }, [direction]);

    const convertedValue = direction === 'eurToLocal' 
        ? amount * info.exchangeRate 
        : amount / info.exchangeRate;

    return (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                <h3 className="font-bold text-gray-800 text-sm uppercase tracking-wider flex items-center gap-2">
                    <Globe size={16} className="text-accent-600"/> Destination Info
                </h3>
            </div>
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                {/* Currency Converter */}
                <div className="space-y-2 min-w-0">
                    <label className="text-xs font-bold text-gray-400 uppercase flex items-center gap-1">
                        <Banknote size={12} /> Currency Converter
                    </label>
                    <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-lg border border-gray-200">
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                                <span>{direction === 'eurToLocal' ? 'EUR' : info.currencyCode}</span>
                            </div>
                            <input 
                                type="number" 
                                value={amount}
                                onChange={(e) => setAmount(Number(e.target.value))}
                                className="w-full bg-transparent font-bold text-gray-800 outline-none min-w-0"
                            />
                        </div>
                        <button 
                            onClick={() => setDirection(direction === 'eurToLocal' ? 'localToEur' : 'eurToLocal')}
                            className="p-1.5 bg-white shadow-sm border border-gray-200 rounded-full hover:bg-gray-100 text-accent-600 flex-shrink-0" aria-label="Swap conversion direction"
                        >
                            <ArrowRightLeft size={14} />
                        </button>
                        <div className="flex-1 text-right min-w-0">
                            <div className="text-xs text-gray-500 mb-1">
                                <span>{direction === 'eurToLocal' ? info.currencyCode : 'EUR'}</span>
                            </div>
                            <div className="font-bold text-gray-800 truncate">
                                {convertedValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                            </div>
                        </div>
                    </div>
                    <div className="text-[10px] text-gray-400 text-center truncate">
                        Rate: 1 EUR ≈ {info.exchangeRate.toFixed(2)} {info.currencyCode}
                    </div>
                </div>

                {/* Languages */}
                <div className="space-y-2 min-w-0">
                    <label className="text-xs font-bold text-gray-400 uppercase flex items-center gap-1">
                        <Globe size={12} /> Languages
                    </label>
                    <div className="flex flex-wrap gap-1">
                        {info.languages.map((lang, i) => (
                            <span key={i} className="px-2 py-1 bg-accent-50 text-accent-700 text-xs font-medium rounded-md border border-accent-100 whitespace-nowrap">
                                {lang}
                            </span>
                        ))}
                    </div>
                </div>

                {/* Sockets */}
                <div className="space-y-2 min-w-0">
                    <label className="text-xs font-bold text-gray-400 uppercase flex items-center gap-1">
                        <Zap size={12} /> Electric Sockets
                    </label>
                    <div className="p-2 bg-gray-50 rounded-lg border border-gray-200 text-sm text-gray-800 break-words">
                        {info.electricSockets}
                    </div>
                </div>

                {/* Links */}
                <div className="space-y-2 min-w-0">
                    <label className="text-xs font-bold text-gray-400 uppercase flex items-center gap-1">
                        <FileText size={12} /> Important Links
                    </label>
                    <div className="flex flex-col gap-2">
                        {info.visaInfoUrl && (
                            <a href={info.visaInfoUrl} target="_blank" rel="noreferrer" className="text-xs text-accent-600 hover:underline flex items-center gap-1 truncate">
                                <ExternalLink size={10} className="flex-shrink-0" /> Visa Information
                            </a>
                        )}
                        {info.auswaertigesAmtUrl && (
                            <a href={info.auswaertigesAmtUrl} target="_blank" rel="noreferrer" className="text-xs text-accent-600 hover:underline flex items-center gap-1 truncate">
                                <ExternalLink size={10} className="flex-shrink-0" /> Auswärtiges Amt (DE)
                            </a>
                        )}
                        {!info.visaInfoUrl && !info.auswaertigesAmtUrl && (
                            <span className="text-xs text-gray-400 italic">No specific links available</span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
