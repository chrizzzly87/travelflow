import React, { useState, useEffect } from 'react';
import { ActivityType, ITimelineItem, ITrip } from '../types';
import { X, Sparkles, Plus, Check } from 'lucide-react';
import { generateActivityProposals } from '../services/geminiService';
import { getRandomActivityColor } from '../utils';

interface AddActivityModalProps {
    isOpen: boolean;
    onClose: () => void;
    dayOffset: number;
    location: string;
    onAdd: (item: Partial<ITimelineItem>) => void;
    trip?: ITrip | null;
    notes?: string;
}

export const AddActivityModal: React.FC<AddActivityModalProps> = ({ isOpen, onClose, dayOffset, location, onAdd, trip, notes }) => {
    const [mode, setMode] = useState<'manual' | 'ai'>('manual');
    const [title, setTitle] = useState('');
    const [selectedTypes, setSelectedTypes] = useState<ActivityType[]>(['general']);
    const [description, setDescription] = useState('');
    
    // AI State
    const [prompt, setPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [proposals, setProposals] = useState<any[]>([]);

    const ALL_ACTIVITY_TYPES: ActivityType[] = [
        'general', 'sightseeing', 'food', 'culture', 'relaxation', 'nightlife',
        'sports', 'hiking', 'wildlife', 'nature', 'shopping', 'adventure', 'beach'
    ];

    // Close on Escape Key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (isOpen && e.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const handleManualAdd = () => {
        if (!title) return;
        onAdd({
            title,
            type: 'activity',
            activityType: selectedTypes,
            description,
            color: getRandomActivityColor(),
            startDateOffset: dayOffset,
            duration: 1,
            location
        });
        onClose();
        reset();
    };

    const handleGenerate = async () => {
        if (!prompt) return;
        setIsGenerating(true);
        
        // Construct Comprehensive Context
        const context = {
            tripTitle: trip?.title || "My Trip",
            preferences: notes || "",
            dayNumber: Math.floor(dayOffset),
            cities: trip?.items.filter(i => i.type === 'city').map(c => ({ 
                name: c.title, 
                dayOffset: c.startDateOffset, 
                duration: c.duration 
            })) || [],
            activities: trip?.items.filter(i => i.type === 'activity').map(a => ({ 
                title: a.title, 
                dayOffset: a.startDateOffset,
                type: Array.isArray(a.activityType) ? a.activityType.join(', ') : a.activityType 
            })) || []
        };

        const results = await generateActivityProposals(prompt, location, context);
        setProposals(results);
        setIsGenerating(false);
    };

    const handleSelectProposal = (proposal: any) => {
        onAdd({
            title: proposal.title,
            type: 'activity',
            activityType: proposal.type ? [proposal.type] : ['general'],
            description: proposal.description,
            color: getRandomActivityColor(),
            startDateOffset: dayOffset,
            duration: 1,
            location,
            aiInsights: {
                cost: proposal.cost,
                bestTime: proposal.bestTime,
                tips: proposal.tips
            }
        });
        onClose();
        reset();
    };

    const toggleType = (type: ActivityType) => {
        if (selectedTypes.includes(type)) {
            // Prevent empty selection
            if (selectedTypes.length > 1) {
                setSelectedTypes(selectedTypes.filter(t => t !== type));
            }
        } else {
            setSelectedTypes([...selectedTypes, type]);
        }
    };

    const reset = () => {
        setTitle('');
        setDescription('');
        setSelectedTypes(['general']);
        setPrompt('');
        setProposals([]);
        setMode('manual');
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[1300] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h3 className="text-lg font-bold text-gray-900">Add Activity for Day {Math.floor(dayOffset) + 1}</h3>
                    <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-full text-gray-500">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-4 border-b border-gray-100 flex gap-2">
                    <button 
                        onClick={() => setMode('manual')}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${mode === 'manual' ? 'bg-indigo-100 text-indigo-700' : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'}`}
                    >
                        Manual Entry
                    </button>
                    <button 
                        onClick={() => setMode('ai')}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${mode === 'ai' ? 'bg-purple-100 text-purple-700' : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'}`}
                    >
                        <Sparkles size={14} /> AI Suggestion
                    </button>
                </div>
                
                <div className="p-6 overflow-y-auto flex-1">
                    {mode === 'manual' ? (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Title</label>
                                <input 
                                    type="text" 
                                    value={title}
                                    onChange={e => setTitle(e.target.value)}
                                    className="w-full p-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                    placeholder="e.g. Visit Louvre Museum"
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Types (Multi-select)</label>
                                <div className="flex flex-wrap gap-2">
                                    {ALL_ACTIVITY_TYPES.map(type => (
                                        <button
                                            key={type}
                                            onClick={() => toggleType(type)}
                                            className={`px-3 py-1 rounded-full text-xs font-bold border transition-colors ${
                                                selectedTypes.includes(type)
                                                ? 'bg-indigo-100 border-indigo-500 text-indigo-700'
                                                : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                                            }`}
                                        >
                                            {type.charAt(0).toUpperCase() + type.slice(1)}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Description</label>
                                <textarea 
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    className="w-full p-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none h-24 resize-none"
                                    placeholder="Notes..."
                                />
                            </div>
                            <button 
                                onClick={handleManualAdd}
                                disabled={!title}
                                className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50"
                            >
                                Add Activity
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="relative">
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">What are you looking for?</label>
                                <div className="flex gap-2">
                                    <input 
                                        type="text" 
                                        value={prompt}
                                        onChange={e => setPrompt(e.target.value)}
                                        className="flex-1 p-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                                        placeholder="e.g. Something romantic for dinner, or kid-friendly park"
                                        onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                                    />
                                    <button 
                                        onClick={handleGenerate}
                                        disabled={!prompt || isGenerating}
                                        className="px-4 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
                                    >
                                        {isGenerating ? 'Thinking...' : 'Generate'}
                                    </button>
                                </div>
                            </div>

                            {proposals.length > 0 && (
                                <div className="grid gap-3">
                                    {proposals.map((p, i) => (
                                        <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 hover:border-purple-300 hover:bg-purple-50 transition-all cursor-pointer group" onClick={() => handleSelectProposal(p)}>
                                            <div className="flex justify-between items-start mb-2">
                                                <h4 className="font-bold text-gray-900">{p.title}</h4>
                                                <span className="text-xs bg-white border border-gray-200 px-2 py-1 rounded-full uppercase font-bold text-gray-500">{p.type}</span>
                                            </div>
                                            <p className="text-sm text-gray-600 mb-3">{p.description}</p>
                                            <div className="flex gap-3 text-xs text-gray-500">
                                                <span>💰 {p.cost}</span>
                                                <span>🕒 {p.bestTime}</span>
                                            </div>
                                            <div className="mt-2 text-xs text-purple-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                                                Click to add <Check size={12} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            
                            {proposals.length === 0 && !isGenerating && (
                                <div className="text-center py-10 text-gray-400">
                                    <Sparkles size={40} className="mx-auto mb-3 opacity-20" />
                                    <p>Enter a wish above to get AI suggestions.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};