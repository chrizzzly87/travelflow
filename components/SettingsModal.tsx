import React, { useState, useEffect } from 'react';
import { X, Layout, Map, Globe, Check } from 'lucide-react';
import { MapStyle } from '../types';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    timelineView: 'horizontal' | 'vertical';
    onToggleView: (view: 'horizontal' | 'vertical') => void;
    mapStyle: MapStyle;
    onMapStyleChange: (style: MapStyle) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, timelineView, onToggleView, mapStyle, onMapStyleChange }) => {
    const [activeTab, setActiveTab] = useState<'layout' | 'appearance' | 'language'>('layout');

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (isOpen && e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[1400] flex items-center justify-center p-4"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]"
                onClick={(e) => e.stopPropagation()}
            >
                
                {/* Header */}
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h3 className="text-lg font-bold text-gray-900">Settings</h3>
                    <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-full text-gray-500">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex flex-1 overflow-hidden">
                    {/* Sidebar Tabs */}
                    <div className="w-48 bg-gray-50 border-r border-gray-100 p-2 space-y-1">
                        <button 
                            onClick={() => setActiveTab('layout')}
                            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'layout' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-600 hover:bg-gray-100'}`}
                        >
                            <Layout size={16} /> Layout
                        </button>
                        <button 
                            onClick={() => setActiveTab('appearance')}
                            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'appearance' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-600 hover:bg-gray-100'}`}
                        >
                            <Map size={16} /> Appearance
                        </button>
                        <button 
                            onClick={() => setActiveTab('language')}
                            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'language' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-600 hover:bg-gray-100'}`}
                        >
                            <Globe size={16} /> Language
                        </button>
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 p-6 overflow-y-auto">
                        
                        {activeTab === 'layout' && (
                            <div className="space-y-6">
                                <div>
                                    <h4 className="text-sm font-bold text-gray-900 mb-3">Timeline Orientation</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <button 
                                            onClick={() => onToggleView('horizontal')}
                                            className={`p-4 rounded-xl border-2 text-left transition-all relative ${timelineView === 'horizontal' ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'}`}
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <span className={`font-semibold ${timelineView === 'horizontal' ? 'text-indigo-900' : 'text-gray-700'}`}>Horizontal</span>
                                                {timelineView === 'horizontal' && <Check size={16} className="text-indigo-600" />}
                                            </div>
                                            <div className="h-2 w-full bg-gray-200 rounded-full mb-2 overflow-hidden">
                                                <div className="h-full w-1/3 bg-gray-400"></div>
                                            </div>
                                            <p className="text-xs text-gray-500">Classic Gantt-style view. Best for visualizing duration overlaps.</p>
                                        </button>

                                        <button 
                                            onClick={() => onToggleView('vertical')}
                                            className={`p-4 rounded-xl border-2 text-left transition-all relative ${timelineView === 'vertical' ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'}`}
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <span className={`font-semibold ${timelineView === 'vertical' ? 'text-indigo-900' : 'text-gray-700'}`}>Vertical</span>
                                                {timelineView === 'vertical' && <Check size={16} className="text-indigo-600" />}
                                            </div>
                                            <div className="flex gap-2 h-8">
                                                <div className="w-1 h-full bg-gray-300 rounded-full"></div>
                                                <div className="flex-1 space-y-1 pt-1">
                                                    <div className="h-1.5 w-1/2 bg-gray-200 rounded-full"></div>
                                                    <div className="h-1.5 w-3/4 bg-gray-200 rounded-full"></div>
                                                </div>
                                            </div>
                                            <p className="text-xs text-gray-500 mt-2">Mobile-friendly list view. Scrolly and easier to read on small screens.</p>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'appearance' && (
                            <div className="space-y-6">
                                <div>
                                    <h4 className="text-sm font-bold text-gray-900 mb-3">Map Tiles</h4>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button 
                                            onClick={() => onMapStyleChange('minimal')}
                                            className={`aspect-video rounded-lg flex flex-col items-center justify-center p-2 border-2 transition-all ${mapStyle === 'minimal' ? 'border-indigo-500 bg-indigo-50' : 'border-transparent bg-gray-100 hover:bg-gray-200'}`}
                                        >
                                            <span className="font-semibold text-gray-800 text-sm">Minimal</span>
                                            <span className="text-xs text-gray-500 mt-1">Clean & Focused</span>
                                        </button>
                                        <button 
                                            onClick={() => onMapStyleChange('standard')}
                                            className={`aspect-video rounded-lg flex flex-col items-center justify-center p-2 border-2 transition-all ${mapStyle === 'standard' ? 'border-indigo-500 bg-indigo-50' : 'border-transparent bg-gray-100 hover:bg-gray-200'}`}
                                        >
                                            <span className="font-semibold text-gray-800 text-sm">Standard</span>
                                            <span className="text-xs text-gray-500 mt-1">Google Default</span>
                                        </button>
                                        <button 
                                            onClick={() => onMapStyleChange('dark')}
                                            className={`aspect-video rounded-lg flex flex-col items-center justify-center p-2 border-2 transition-all ${mapStyle === 'dark' ? 'border-indigo-500 bg-gray-800' : 'border-transparent bg-gray-800 hover:bg-gray-700'}`}
                                        >
                                            <span className="font-semibold text-white text-sm">Dark</span>
                                            <span className="text-xs text-gray-400 mt-1">Night Mode</span>
                                        </button>
                                        <button 
                                            onClick={() => onMapStyleChange('satellite')}
                                            className={`aspect-video rounded-lg flex flex-col items-center justify-center p-2 border-2 transition-all ${mapStyle === 'satellite' ? 'border-indigo-500 bg-green-900' : 'border-transparent bg-green-900 hover:bg-green-800'}`}
                                        >
                                            <span className="font-semibold text-white text-sm">Satellite</span>
                                            <span className="text-xs text-gray-300 mt-1">Aerial View</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'language' && (
                            <div className="space-y-6">
                                <div className="p-4 bg-yellow-50 border border-yellow-100 rounded-lg text-sm text-yellow-800">
                                    <strong>TODO: Localization</strong>
                                    <p className="mt-1">Future feature: Change application language, date formats (DD/MM vs MM/DD), and currency display.</p>
                                </div>
                                <div className="opacity-50 pointer-events-none">
                                     <label className="block text-sm font-bold text-gray-700 mb-1">App Language</label>
                                     <select className="w-full p-2 border border-gray-300 rounded-lg bg-gray-50">
                                         <option>English (US)</option>
                                         <option>German</option>
                                         <option>French</option>
                                         <option>Japanese</option>
                                     </select>
                                </div>
                            </div>
                        )}

                    </div>
                </div>
                
                <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
                    <button onClick={onClose} className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700">
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
};
