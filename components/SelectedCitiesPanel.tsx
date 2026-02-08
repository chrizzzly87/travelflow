import React, { useEffect, useMemo, useState } from 'react';
import { ITimelineItem } from '../types';
import { ArrowDown, ArrowUp, ArrowUpDown, X } from 'lucide-react';

interface SelectedCitiesPanelProps {
    selectedCities: ITimelineItem[];
    onClose: () => void;
    onApplyOrder: (orderedCityIds: string[]) => void;
    onReverse: () => void;
    readOnly?: boolean;
}

export const SelectedCitiesPanel: React.FC<SelectedCitiesPanelProps> = ({
    selectedCities,
    onClose,
    onApplyOrder,
    onReverse,
    readOnly = false
}) => {
    const canEdit = !readOnly;
    const [orderedCityIds, setOrderedCityIds] = useState<string[]>([]);

    useEffect(() => {
        setOrderedCityIds(selectedCities.map(city => city.id));
    }, [selectedCities]);

    const cityById = useMemo(
        () => new Map(selectedCities.map(city => [city.id, city])),
        [selectedCities]
    );

    const baselineOrder = selectedCities.map(city => city.id);
    const hasCustomOrder = baselineOrder.some((id, index) => id !== orderedCityIds[index]);

    const moveCity = (fromIndex: number, toIndex: number) => {
        if (!canEdit) return;
        if (toIndex < 0 || toIndex >= orderedCityIds.length) return;
        const next = [...orderedCityIds];
        const [moved] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, moved);
        setOrderedCityIds(next);
    };

    return (
        <div className="h-full flex flex-col bg-gray-50 border-l border-gray-200">
            <div className="bg-white border-b border-gray-100 p-4 relative">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-500"
                    title="Close selection"
                >
                    <X size={16} />
                </button>
                <div className="pr-10">
                    <div className="text-xs font-bold uppercase tracking-wider text-accent-600">Selected Cities</div>
                    <h2 className="text-xl font-bold text-gray-900 mt-1">{selectedCities.length} selected</h2>
                    <p className="text-xs text-gray-500 mt-2">
                        Reorder the selected stops, then apply. Activities move with their city, and changed routes are reset to N/A.
                    </p>
                </div>
            </div>

            <div className="p-4 border-b border-gray-100 bg-white flex items-center gap-2">
                <button
                    onClick={() => { if (!canEdit) return; onReverse(); }}
                    disabled={!canEdit}
                    className={`px-3 py-2 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 flex items-center gap-1.5 ${canEdit ? 'hover:bg-gray-50' : 'opacity-50 cursor-not-allowed'}`}
                    title="Reverse selected city order"
                >
                    <ArrowUpDown size={14} />
                    Reverse Selected
                </button>
                <button
                    onClick={() => { if (!canEdit) return; setOrderedCityIds(baselineOrder); }}
                    disabled={!hasCustomOrder || !canEdit}
                    className={`px-3 py-2 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 ${canEdit ? 'hover:bg-gray-50' : 'opacity-50 cursor-not-allowed'} disabled:opacity-40 disabled:cursor-not-allowed`}
                    title="Reset panel order"
                >
                    Reset
                </button>
                <button
                    onClick={() => { if (!canEdit) return; onApplyOrder(orderedCityIds); }}
                    disabled={!hasCustomOrder || !canEdit}
                    className={`ml-auto px-3 py-2 rounded-lg bg-accent-600 text-white text-xs font-semibold ${canEdit ? 'hover:bg-accent-700' : 'opacity-50 cursor-not-allowed'} disabled:opacity-40 disabled:cursor-not-allowed`}
                    title="Apply custom selected order"
                >
                    Apply Order
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {orderedCityIds.map((cityId, index) => {
                    const city = cityById.get(cityId);
                    if (!city) return null;
                    const colorClass = (city.color || '').split(' ')[0] || 'bg-gray-200';
                    return (
                        <div
                            key={cityId}
                            className="bg-white border border-gray-100 rounded-xl p-3 flex items-center gap-3"
                        >
                            <div className="text-xs font-bold text-gray-400 w-5 text-center">{index + 1}</div>
                            <div className={`w-2.5 h-2.5 rounded-full ${colorClass}`} />
                            <div className="min-w-0">
                                <div className="text-sm font-semibold text-gray-900 truncate">{city.title}</div>
                                <div className="text-[11px] text-gray-500">{Number(city.duration.toFixed(1))} nights</div>
                            </div>
                            <div className="ml-auto flex items-center gap-1">
                                <button
                                    onClick={() => moveCity(index, index - 1)}
                                    disabled={index === 0 || !canEdit}
                                    className={`p-1.5 rounded-md border border-gray-200 text-gray-500 ${canEdit ? 'hover:bg-gray-50' : 'opacity-50 cursor-not-allowed'} disabled:opacity-40 disabled:cursor-not-allowed`}
                                    title="Move up"
                                >
                                    <ArrowUp size={13} />
                                </button>
                                <button
                                    onClick={() => moveCity(index, index + 1)}
                                    disabled={index === orderedCityIds.length - 1 || !canEdit}
                                    className={`p-1.5 rounded-md border border-gray-200 text-gray-500 ${canEdit ? 'hover:bg-gray-50' : 'opacity-50 cursor-not-allowed'} disabled:opacity-40 disabled:cursor-not-allowed`}
                                    title="Move down"
                                >
                                    <ArrowDown size={13} />
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
