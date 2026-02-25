import React, { useState } from 'react';
import { Layout, Map, Globe, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AppLanguage, MapStyle } from '../types';
import { LOCALE_DROPDOWN_ORDER, LOCALE_FLAGS, LOCALE_LABELS } from '../config/locales';
import { AppModal } from './ui/app-modal';
import { FlagIcon } from './flags/FlagIcon';
import { Select, SelectContent, SelectItem, SelectTrigger } from './ui/select';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    timelineView?: 'horizontal' | 'vertical';
    onToggleView?: (view: 'horizontal' | 'vertical') => void;
    mapStyle?: MapStyle;
    onMapStyleChange?: (style: MapStyle) => void;
    appLanguage?: AppLanguage;
    onAppLanguageChange?: (language: AppLanguage) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
    isOpen,
    onClose,
    timelineView = 'horizontal',
    onToggleView,
    mapStyle = 'standard',
    onMapStyleChange,
    appLanguage = 'en',
    onAppLanguageChange
}) => {
    const { t } = useTranslation(['settings', 'common']);
    const [activeTab, setActiveTab] = useState<'layout' | 'appearance' | 'language'>('layout');
    const appLanguageSelectId = 'settings-app-language';

    return (
        <AppModal
            isOpen={isOpen}
            onClose={onClose}
            title={t('settings:title')}
            closeLabel="Close settings dialog"
            size="lg"
            mobileSheet={false}
            contentClassName="max-h-[85vh] sm:max-w-2xl"
            bodyClassName="flex flex-1 overflow-hidden p-0"
            footer={(
                <div className="flex justify-end">
                    <button type="button" onClick={onClose} className="rounded-lg bg-accent-600 px-4 py-2 font-medium text-white hover:bg-accent-700">
                        {t('common:buttons.done')}
                    </button>
                </div>
            )}
        >
                    {/* Sidebar Tabs */}
                    <div className="w-48 bg-gray-50 border-r border-gray-100 p-2 space-y-1">
                        <button 
                            type="button"
                            onClick={() => setActiveTab('layout')}
                            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'layout' ? 'bg-white shadow-sm text-accent-600' : 'text-gray-600 hover:bg-gray-100'}`}
                        >
                            <Layout size={16} /> {t('settings:tabs.layout')}
                        </button>
                        <button 
                            type="button"
                            onClick={() => setActiveTab('appearance')}
                            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'appearance' ? 'bg-white shadow-sm text-accent-600' : 'text-gray-600 hover:bg-gray-100'}`}
                        >
                            <Map size={16} /> {t('settings:tabs.appearance')}
                        </button>
                        <button 
                            type="button"
                            onClick={() => setActiveTab('language')}
                            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'language' ? 'bg-white shadow-sm text-accent-600' : 'text-gray-600 hover:bg-gray-100'}`}
                        >
                            <Globe size={16} /> {t('settings:tabs.language')}
                        </button>
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 p-6 overflow-y-auto">
                        
                        {activeTab === 'layout' && (
                            <div className="space-y-6">
                                <div>
                                    <h4 className="text-sm font-bold text-gray-900 mb-3">{t('settings:layout.timelineOrientation')}</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <button 
                                            type="button"
                                            onClick={() => onToggleView?.('horizontal')}
                                            disabled={!onToggleView}
                                            className={`p-4 rounded-xl border-2 text-left transition-all relative ${timelineView === 'horizontal' ? 'border-accent-500 bg-accent-50' : 'border-gray-200 hover:border-gray-300'} ${!onToggleView ? 'opacity-60 cursor-not-allowed' : ''}`}
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <span className={`font-semibold ${timelineView === 'horizontal' ? 'text-accent-900' : 'text-gray-700'}`}>{t('settings:layout.horizontal')}</span>
                                                {timelineView === 'horizontal' && <Check size={16} className="text-accent-600" />}
                                            </div>
                                            <div className="h-2 w-full bg-gray-200 rounded-full mb-2 overflow-hidden">
                                                <div className="h-full w-1/3 bg-gray-400"></div>
                                            </div>
                                            <p className="text-xs text-gray-500">{t('settings:layout.horizontalDescription')}</p>
                                        </button>

                                        <button 
                                            type="button"
                                            onClick={() => onToggleView?.('vertical')}
                                            disabled={!onToggleView}
                                            className={`p-4 rounded-xl border-2 text-left transition-all relative ${timelineView === 'vertical' ? 'border-accent-500 bg-accent-50' : 'border-gray-200 hover:border-gray-300'} ${!onToggleView ? 'opacity-60 cursor-not-allowed' : ''}`}
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <span className={`font-semibold ${timelineView === 'vertical' ? 'text-accent-900' : 'text-gray-700'}`}>{t('settings:layout.vertical')}</span>
                                                {timelineView === 'vertical' && <Check size={16} className="text-accent-600" />}
                                            </div>
                                            <div className="flex gap-2 h-8">
                                                <div className="w-1 h-full bg-gray-300 rounded-full"></div>
                                                <div className="flex-1 space-y-1 pt-1">
                                                    <div className="h-1.5 w-1/2 bg-gray-200 rounded-full"></div>
                                                    <div className="h-1.5 w-3/4 bg-gray-200 rounded-full"></div>
                                                </div>
                                            </div>
                                            <p className="text-xs text-gray-500 mt-2">{t('settings:layout.verticalDescription')}</p>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'appearance' && (
                            <div className="space-y-6">
                                <div>
                                    <h4 className="text-sm font-bold text-gray-900 mb-3">{t('settings:appearance.mapTiles')}</h4>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button 
                                            type="button"
                                            onClick={() => onMapStyleChange?.('minimal')}
                                            disabled={!onMapStyleChange}
                                            className={`aspect-video rounded-lg flex flex-col items-center justify-center p-2 border-2 transition-all ${mapStyle === 'minimal' ? 'border-accent-500 bg-accent-50' : 'border-transparent bg-gray-100 hover:bg-gray-200'} ${!onMapStyleChange ? 'opacity-60 cursor-not-allowed' : ''}`}
                                        >
                                            <span className="font-semibold text-gray-800 text-sm">{t('settings:appearance.minimal')}</span>
                                            <span className="text-xs text-gray-500 mt-1">{t('settings:appearance.minimalDescription')}</span>
                                        </button>
                                        <button 
                                            type="button"
                                            onClick={() => onMapStyleChange?.('standard')}
                                            disabled={!onMapStyleChange}
                                            className={`aspect-video rounded-lg flex flex-col items-center justify-center p-2 border-2 transition-all ${mapStyle === 'standard' ? 'border-accent-500 bg-accent-50' : 'border-transparent bg-gray-100 hover:bg-gray-200'} ${!onMapStyleChange ? 'opacity-60 cursor-not-allowed' : ''}`}
                                        >
                                            <span className="font-semibold text-gray-800 text-sm">{t('settings:appearance.standard')}</span>
                                            <span className="text-xs text-gray-500 mt-1">{t('settings:appearance.standardDescription')}</span>
                                        </button>
                                        <button 
                                            type="button"
                                            onClick={() => onMapStyleChange?.('dark')}
                                            disabled={!onMapStyleChange}
                                            className={`aspect-video rounded-lg flex flex-col items-center justify-center p-2 border-2 transition-all ${mapStyle === 'dark' ? 'border-accent-500 bg-gray-800' : 'border-transparent bg-gray-800 hover:bg-gray-700'} ${!onMapStyleChange ? 'opacity-60 cursor-not-allowed' : ''}`}
                                        >
                                            <span className="font-semibold text-white text-sm">{t('settings:appearance.dark')}</span>
                                            <span className="text-xs text-gray-400 mt-1">{t('settings:appearance.darkDescription')}</span>
                                        </button>
                                        <button 
                                            type="button"
                                            onClick={() => onMapStyleChange?.('satellite')}
                                            disabled={!onMapStyleChange}
                                            className={`aspect-video rounded-lg flex flex-col items-center justify-center p-2 border-2 transition-all ${mapStyle === 'satellite' ? 'border-accent-500 bg-green-900' : 'border-transparent bg-green-900 hover:bg-green-800'} ${!onMapStyleChange ? 'opacity-60 cursor-not-allowed' : ''}`}
                                        >
                                            <span className="font-semibold text-white text-sm">{t('settings:appearance.satellite')}</span>
                                            <span className="text-xs text-gray-300 mt-1">{t('settings:appearance.satelliteDescription')}</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'language' && (
                            <div className="space-y-6">
                                <div className="p-4 bg-accent-50 border border-accent-100 rounded-lg text-sm text-accent-800">
                                    <strong>{t('settings:language.noteTitle')}</strong>
                                    <p className="mt-1">{t('settings:language.noteDescription')}</p>
                                </div>
                                <div>
                                     <label htmlFor={appLanguageSelectId} className="block text-sm font-bold text-gray-700 mb-1">{t('settings:language.appLanguage')}</label>
                                     <Select value={appLanguage} onValueChange={(value) => onAppLanguageChange?.(value as AppLanguage)}>
                                        <SelectTrigger id={appLanguageSelectId} className="w-full border-gray-300 bg-white text-sm">
                                            <span className="inline-flex items-center gap-2">
                                                <FlagIcon code={LOCALE_FLAGS[appLanguage]} size="sm" className="shrink-0" />
                                                <span>{LOCALE_LABELS[appLanguage]}</span>
                                            </span>
                                        </SelectTrigger>
                                        <SelectContent>
                                            {LOCALE_DROPDOWN_ORDER.map((locale) => (
                                                <SelectItem key={`settings-locale-${locale}`} value={locale} textValue={LOCALE_LABELS[locale]}>
                                                    <span className="inline-flex items-center gap-2">
                                                        <FlagIcon code={LOCALE_FLAGS[locale]} size="sm" className="shrink-0" />
                                                        <span>{LOCALE_LABELS[locale]}</span>
                                                    </span>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                     </Select>
                                </div>
                            </div>
                        )}

                    </div>
        </AppModal>
    );
};
