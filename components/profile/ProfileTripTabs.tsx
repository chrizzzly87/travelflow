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
                ? 'border-accent-300 bg-accent-50 text-accent-900 dark:bg-accent-400/12 dark:text-accent-200 dark:border-accent-400/30'
                : 'border-border bg-card text-foreground hover:border-border hover:text-foreground',
              tab.disabled ? 'cursor-not-allowed opacity-70' : '',
            ].join(' ')}
            {...(analyticsAttrs ? analyticsAttrs(tab.id) : {})}
          >
            <span>{tab.label}</span>
            <span
              className={[
                'rounded-full px-2 py-0.5 text-xs font-bold',
                isActive ? 'bg-accent-100 text-accent-800 dark:bg-accent-400/12 dark:text-accent-200' : 'bg-secondary text-muted-foreground',
              ].join(' ')}
            >
              {tab.count}
            </span>
            {tab.badge && (
              <span className="rounded-full border border-border bg-secondary px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
