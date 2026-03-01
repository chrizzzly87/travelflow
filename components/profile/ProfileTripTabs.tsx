import React from 'react';
import type { ProfileTripTab } from './profileTripState';

export interface ProfileTabItem {
  id: ProfileTripTab;
  label: string;
  count: number;
  disabled?: boolean;
  badge?: string;
}

interface ProfileTripTabsProps {
  activeTab: ProfileTripTab;
  tabs: ProfileTabItem[];
  onTabChange: (tab: ProfileTripTab) => void;
  analyticsAttrs?: (tab: ProfileTripTab) => Record<string, string>;
}

export const ProfileTripTabs: React.FC<ProfileTripTabsProps> = ({
  activeTab,
  tabs,
  onTabChange,
  analyticsAttrs,
}) => {
  return (
    <div className="flex flex-wrap gap-2" role="tablist" aria-label="Profile trip categories">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            disabled={tab.disabled}
            onClick={() => onTabChange(tab.id)}
            className={[
              'inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-semibold transition-colors',
              isActive
                ? 'border-accent-300 bg-accent-50 text-accent-900'
                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:text-slate-900',
              tab.disabled ? 'cursor-not-allowed opacity-70' : '',
            ].join(' ')}
            {...(analyticsAttrs ? analyticsAttrs(tab.id) : {})}
          >
            <span>{tab.label}</span>
            <span
              className={[
                'rounded-full px-2 py-0.5 text-xs font-bold',
                isActive ? 'bg-accent-100 text-accent-800' : 'bg-slate-100 text-slate-600',
              ].join(' ')}
            >
              {tab.count}
            </span>
            {tab.badge && (
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-500">
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
