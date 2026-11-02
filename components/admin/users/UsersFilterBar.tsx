import React from 'react';
import { CaretDown, DownloadSimple, X } from '@phosphor-icons/react';
import { Button } from '../../ui/button';
import { AdminFilterMenu, type AdminFilterMenuOption } from '../AdminFilterMenu';
import { getAnalyticsDebugAttributes, trackEvent } from '../../../services/analyticsService';
import { USER_VISIBLE_COLUMN_OPTIONS, type UserTableFilterKey } from '../adminUsersModel';
import { LoginTypeFilterMenu } from './LoginTypeFilterMenu';
import type { AdminUsersStateApi } from './useAdminUsersState';

const VISIBLE_COLUMN_MENU_OPTIONS: AdminFilterMenuOption[] = USER_VISIBLE_COLUMN_OPTIONS.map((option) => ({
    value: option.value,
    label: option.label,
}));

/** Filter menus, the column picker and CSV export above the users table. */
export const UsersFilterBar: React.FC<{
    table: AdminUsersStateApi;
    onExportCsv: () => void;
}> = ({ table, onExportCsv }) => {
    const { state, filterOptions, actions } = table;
    const { filters } = state;

    const filterMenu = (label: string, key: Exclude<UserTableFilterKey, 'loginType' | 'socialProvider'>) => (
        <AdminFilterMenu
            label={label}
            options={filterOptions[key]}
            selectedValues={filters[key]}
            onSelectedValuesChange={(next: string[]) => actions.setFilter(key, next)}
        />
    );

    return (
        <div className="flex flex-wrap items-center gap-2" role="toolbar" aria-label="Filter users">
            {filterMenu('Status', 'status')}
            {filterMenu('Activation', 'activation')}
            {filterMenu('Plan', 'tier')}
            <LoginTypeFilterMenu
                selectedLoginTypes={filters.loginType}
                selectedSocialProviders={filters.socialProvider}
                counts={table.loginFilterCounts}
                onSelectedLoginTypesChange={(next) => actions.setFilter('loginType', next)}
                onSelectedSocialProvidersChange={(next) => actions.setFilter('socialProvider', next)}
            />
            {filterMenu('Trips', 'trips')}
            {table.showMoreFilters ? (
                <>
                    {filterMenu('Subscription', 'subscription')}
                    {filterMenu('Role', 'role')}
                    {filterMenu('Terms', 'terms')}
                </>
            ) : (
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => {
                        trackEvent('admin__users--more_filters');
                        actions.openMoreFilters();
                    }}
                    {...getAnalyticsDebugAttributes('admin__users--more_filters')}
                >
                    More filters
                    <CaretDown />
                </Button>
            )}
            {table.hasActiveFilters && (
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => {
                        trackEvent('admin__users--reset_filters');
                        actions.resetFilters();
                    }}
                    {...getAnalyticsDebugAttributes('admin__users--reset_filters')}
                >
                    <X />
                    Reset
                </Button>
            )}
            <div className="ms-auto flex items-center gap-2">
                <AdminFilterMenu
                    label="Columns"
                    options={VISIBLE_COLUMN_MENU_OPTIONS}
                    selectedValues={state.visibleColumns}
                    showBulkActions={false}
                    onSelectedValuesChange={actions.setVisibleColumns}
                />
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={onExportCsv}
                    disabled={table.filteredUsers.length === 0}
                    data-tooltip="Billing columns for the users shown"
                    {...getAnalyticsDebugAttributes('admin__users--export_csv')}
                >
                    <DownloadSimple />
                    Export CSV
                </Button>
            </div>
        </div>
    );
};
