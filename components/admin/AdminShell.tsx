import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, useLocation } from '@/app/navigation';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
    CaretRight,
    Flask,
    Info,
    List,
    MagnifyingGlass,
    SidebarSimple,
    X,
} from '@phosphor-icons/react';
import { getAnalyticsDebugAttributes, trackEvent } from '../../services/analyticsService';
import {
    SIMULATED_LOGIN_DEBUG_EVENT,
    SIMULATED_LOGIN_STORAGE_KEY,
    isSimulatedLoggedIn,
    setSimulatedLoggedIn,
} from '../../services/simulatedLoginService';
import {
    ADMIN_NAV_ITEMS,
    ADMIN_NAV_SECTIONS,
    findActiveAdminNavItem,
    getAdminNavSectionLabel,
    type AdminNavItem,
    type AdminNavSection,
} from './adminNavConfig';
import { AccountMenu } from '../navigation/AccountMenu';
import { useAuth } from '../../hooks/useAuth';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { SearchInput } from '../ui/search-input';
import { Button } from '../ui/button';
import { Kbd } from '../ui/kbd';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { ThemeToggle } from '../ui/ThemeToggle';
import { AppBrand } from '../navigation/AppBrand';
import { cn } from '../../lib/utils';
import { AdminCommandMenu } from './AdminCommandMenu';
import { AdminNavIcon } from './AdminNavIcon';
import {
    type AdminDateRange,
    DEV_ADMIN_BYPASS_DISABLED_SESSION_KEY,
    getStoredSidebarCollapseState,
    isDevAdminBypassDisabled,
    persistSidebarCollapseState,
} from './adminShellUtils';

interface AdminShellProps {
    title: string;
    description?: string;
    children: React.ReactNode;
    actions?: React.ReactNode;
    searchValue?: string;
    onSearchValueChange?: (value: string) => void;
    dateRange?: AdminDateRange;
    onDateRangeChange?: (next: AdminDateRange) => void;
    showGlobalSearch?: boolean;
    showDateRange?: boolean;
}

const DATE_RANGE_OPTIONS: Array<{ value: AdminDateRange; label: string }> = [
    { value: '7d', label: 'Last 7 days' },
    { value: '30d', label: 'Last 30 days' },
    { value: '90d', label: 'Last 90 days' },
    { value: 'all', label: 'All time' },
];

type AdminNavGroup = AdminNavSection & { items: AdminNavItem[] };

const NAV_GROUPS: AdminNavGroup[] = ADMIN_NAV_SECTIONS.reduce<AdminNavGroup[]>((groups, section) => {
    const items = ADMIN_NAV_ITEMS.filter((item) => item.section === section.id);
    if (items.length > 0) groups.push({ ...section, items });
    return groups;
}, []);

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

interface AdminNavListProps {
    collapsed: boolean;
    onItemClick: (id: string) => void;
}

const AdminNavList: React.FC<AdminNavListProps> = ({ collapsed, onItemClick }) => (
    <nav aria-label="Admin sections" className="flex flex-col gap-4">
        {NAV_GROUPS.map((group) => (
            <div key={group.id} className="flex flex-col gap-0.5">
                {collapsed
                    ? <div className="mx-auto mb-1 h-px w-5 bg-sidebar-border first:hidden" aria-hidden="true" />
                    : <div className="px-2 pb-1 text-xs font-medium text-muted-foreground">{group.label}</div>}
                {group.items.map((item) => (
                    <NavLink
                        key={item.id}
                        to={item.path}
                        end={item.path === '/admin/ai-benchmark'}
                        aria-label={collapsed ? item.label : undefined}
                        data-tooltip={collapsed ? item.label : undefined}
                        className={({ isActive }) => cn(
                            'group flex h-8 items-center gap-2.5 rounded-md text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
                            collapsed ? 'justify-center' : 'px-2',
                            isActive
                                ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
                                : 'text-muted-foreground hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground',
                        )}
                        onClick={() => onItemClick(item.id)}
                        {...getAnalyticsDebugAttributes(`admin__menu--${item.id}`)}
                    >
                        {({ isActive }) => (
                            <>
                                <AdminNavIcon
                                    icon={item.icon}
                                    weight={isActive ? 'fill' : 'regular'}
                                    className={cn('size-4 shrink-0', isActive && 'text-accent-600 dark:text-accent-300')}
                                />
                                {!collapsed && <span className="truncate">{item.label}</span>}
                            </>
                        )}
                    </NavLink>
                ))}
            </div>
        ))}
    </nav>
);

interface SidebarSearchButtonProps {
    collapsed: boolean;
    onOpen: () => void;
}

const SidebarSearchButton: React.FC<SidebarSearchButtonProps> = ({ collapsed, onOpen }) => (
    <button
        type="button"
        onClick={onOpen}
        aria-label="Search admin"
        aria-keyshortcuts={IS_MAC ? 'Meta+K' : 'Control+K'}
        data-tooltip={collapsed ? 'Search (⌘K)' : undefined}
        className={cn(
            'flex h-8 items-center gap-2 rounded-md border border-sidebar-border bg-background text-sm text-muted-foreground shadow-xs transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none dark:bg-input/30',
            collapsed ? 'w-8 justify-center self-center' : 'w-full px-2',
        )}
        {...getAnalyticsDebugAttributes('admin__menu--search')}
    >
        <MagnifyingGlass className="size-4 shrink-0" />
        {!collapsed && (
            <>
                <span className="flex-1 text-start">Search</span>
                <Kbd>{IS_MAC ? '⌘K' : 'Ctrl K'}</Kbd>
            </>
        )}
    </button>
);

export const AdminShell: React.FC<AdminShellProps> = ({
    title,
    description,
    children,
    actions,
    searchValue = '',
    onSearchValueChange,
    dateRange = '30d',
    onDateRangeChange,
    showGlobalSearch = true,
    showDateRange = true,
}) => {
    const routeLocation = useLocation();
    const { access, isAdmin } = useAuth();
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => getStoredSidebarCollapseState());
    const [mobileNavPath, setMobileNavPath] = useState<string | null>(null);
    const [isCommandOpen, setIsCommandOpen] = useState(false);
    const mobileNavCloseRef = useRef<HTMLButtonElement>(null);
    const mobileNavTriggerRef = useRef<HTMLButtonElement>(null);
    const [isSimulatedDebugLoginActive, setIsSimulatedDebugLoginActive] = useState<boolean>(() => isSimulatedLoggedIn());
    const [isDevAdminBypassActive, setIsDevAdminBypassActive] = useState(false);

    // The mobile sheet belongs to the route it was opened on, so navigating
    // closes it without an effect.
    const isMobileNavOpen = mobileNavPath === routeLocation.pathname;
    const activeItem = findActiveAdminNavItem(routeLocation.pathname);

    const syncAdminRuntimeFlags = useCallback(() => {
        setIsSimulatedDebugLoginActive(isSimulatedLoggedIn());

        if (typeof window === 'undefined') {
            setIsDevAdminBypassActive(false);
            return;
        }

        const bypassConfigured = import.meta.env.DEV && import.meta.env.VITE_DEV_ADMIN_BYPASS === 'true';
        const bypassDisabled = isDevAdminBypassDisabled();
        const bypassSessionUser = (access?.userId || '').trim() === 'dev-admin-id';
        setIsDevAdminBypassActive(bypassConfigured && !bypassDisabled && bypassSessionUser);
    }, [access?.userId]);

    const handleDisableSimulatedLogin = useCallback(() => {
        setSimulatedLoggedIn(false);
        syncAdminRuntimeFlags();
    }, [syncAdminRuntimeFlags]);

    // Side effects stay out of the state updater, which may run twice.
    const toggleSidebar = useCallback(() => {
        const next = !isSidebarCollapsed;
        setIsSidebarCollapsed(next);
        persistSidebarCollapseState(next);
        trackEvent('admin__menu--collapse_toggle', { collapsed: next });
    }, [isSidebarCollapsed]);

    useEffect(() => {
        syncAdminRuntimeFlags();
        if (typeof window === 'undefined') return;

        const handleStorage = (event: StorageEvent) => {
            if (event.key && event.key !== SIMULATED_LOGIN_STORAGE_KEY && event.key !== DEV_ADMIN_BYPASS_DISABLED_SESSION_KEY) {
                return;
            }
            syncAdminRuntimeFlags();
        };
        window.addEventListener('storage', handleStorage);
        window.addEventListener(SIMULATED_LOGIN_DEBUG_EVENT, syncAdminRuntimeFlags as EventListener);
        return () => {
            window.removeEventListener('storage', handleStorage);
            window.removeEventListener(SIMULATED_LOGIN_DEBUG_EVENT, syncAdminRuntimeFlags as EventListener);
        };
    }, [syncAdminRuntimeFlags]);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            const key = event.key.toLowerCase();
            if (key === 'k' && (event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey) {
                event.preventDefault();
                setIsCommandOpen((current) => !current);
                return;
            }
            // ⌘B / Ctrl+B mirrors the shadcn sidebar shortcut.
            if (key === 'b' && (event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey) {
                event.preventDefault();
                toggleSidebar();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [toggleSidebar]);

    const handleMenuItemClick = (id: string) => {
        trackEvent(`admin__menu--${id}`);
        setMobileNavPath(null);
    };

    const openCommandMenu = () => {
        trackEvent('admin__menu--search');
        setMobileNavPath(null);
        setIsCommandOpen(true);
    };

    const breadcrumbs = useMemo(() => {
        const trail: string[] = [];
        if (activeItem) {
            const sectionLabel = getAdminNavSectionLabel(activeItem.section);
            if (sectionLabel) trail.push(sectionLabel);
            trail.push(activeItem.label);
        } else {
            trail.push(title);
        }
        return trail;
    }, [activeItem, title]);

    const hasToolbar = showGlobalSearch || showDateRange || Boolean(actions);

    const accountMenu = (collapsed: boolean) => (isAdmin ? (
        <AccountMenu
            email={access?.email || null}
            userId={access?.userId || null}
            isAdmin
            compact={collapsed}
            showLabel={!collapsed}
            fullWidth={!collapsed}
            menuPlacement="right-end"
            labelMode="identity"
            showRecentTripsSection={false}
            showCurrentPageSummary={false}
            className={collapsed ? 'mx-auto' : 'w-full min-w-0'}
        />
    ) : null);

    const brandLink = (collapsed: boolean) => (
        <NavLink
            to="/admin/dashboard"
            className={cn(
                'flex h-9 min-w-0 items-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
                collapsed ? 'justify-center' : 'gap-2 px-1',
            )}
            aria-label="Admin overview"
            onClick={() => handleMenuItemClick('brand')}
            {...getAnalyticsDebugAttributes('admin__menu--brand')}
        >
            <AppBrand
                className={collapsed ? 'gap-0' : undefined}
                wordmarkClassName={cn('text-[15px] font-bold tracking-tight text-foreground', collapsed && 'hidden')}
            />
            {!collapsed && (
                <span className="rounded border border-sidebar-border px-1.5 py-px text-[11px] font-medium text-muted-foreground">
                    Admin
                </span>
            )}
        </NavLink>
    );

    return (
        <div
            className={cn(
                'flex min-h-dvh w-full bg-background text-foreground',
                // Press feedback on every admin button: the UI confirms it heard
                // the click. Skipped under reduced motion.
                'motion-safe:[&_[data-slot=button]:not(:disabled):active]:scale-[0.97]',
            )}
        >
            {/* Desktop sidebar: pinned to the viewport with its own scroll area,
                so long tables scroll the page without dragging the nav along. */}
            <aside
                className={cn(
                    'sticky top-0 hidden h-dvh shrink-0 flex-col border-e border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none lg:flex',
                    isSidebarCollapsed ? 'w-14' : 'w-60',
                )}
                aria-label="Admin navigation"
                data-collapsed={isSidebarCollapsed ? 'true' : 'false'}
            >
                <div className={cn('flex flex-col gap-3 pt-3', isSidebarCollapsed ? 'px-2' : 'px-3')}>
                    {brandLink(isSidebarCollapsed)}
                    <SidebarSearchButton collapsed={isSidebarCollapsed} onOpen={openCommandMenu} />
                </div>
                <div className={cn('min-h-0 flex-1 overflow-y-auto py-4', isSidebarCollapsed ? 'px-2' : 'px-3')}>
                    <AdminNavList collapsed={isSidebarCollapsed} onItemClick={handleMenuItemClick} />
                </div>
                <div className={cn('flex flex-col gap-2 border-t border-sidebar-border py-3', isSidebarCollapsed ? 'items-center px-2' : 'px-3')}>
                    {accountMenu(isSidebarCollapsed)}
                </div>
            </aside>

            {/* Mobile sidebar: a real dialog (focus trap, Escape, backdrop,
                focus returned to the menu button). */}
            <DialogPrimitive.Root
                open={isMobileNavOpen}
                onOpenChange={(open) => setMobileNavPath(open ? routeLocation.pathname : null)}
            >
                <DialogPrimitive.Portal>
                    <DialogPrimitive.Overlay className="fixed inset-0 z-[1700] bg-black/45 backdrop-blur-[1.5px] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 lg:hidden" />
                    <DialogPrimitive.Content
                        aria-modal="true"
                        // Focus the close control, not the brand link that comes first,
                        // so Escape/Enter has an obvious target on open.
                        onOpenAutoFocus={(event) => {
                            event.preventDefault();
                            mobileNavCloseRef.current?.focus();
                        }}
                        // The menu button is not a Radix trigger, so return focus to it by hand.
                        onCloseAutoFocus={(event) => {
                            event.preventDefault();
                            mobileNavTriggerRef.current?.focus();
                        }}
                        className="fixed inset-y-0 start-0 z-[1701] flex w-[min(18rem,85vw)] flex-col border-e border-sidebar-border bg-sidebar text-sidebar-foreground shadow-2xl outline-none data-[state=open]:animate-in data-[state=open]:slide-in-from-left data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left lg:hidden"
                    >
                        <DialogPrimitive.Title className="sr-only">Admin navigation</DialogPrimitive.Title>
                        <DialogPrimitive.Description className="sr-only">Jump to another admin screen.</DialogPrimitive.Description>
                        <div className="flex items-center justify-between gap-2 px-3 pt-3">
                            {brandLink(false)}
                            <DialogPrimitive.Close asChild>
                                <Button ref={mobileNavCloseRef} variant="ghost" size="icon-sm" aria-label="Close navigation">
                                    <X />
                                </Button>
                            </DialogPrimitive.Close>
                        </div>
                        <div className="px-3 pt-3">
                            <SidebarSearchButton collapsed={false} onOpen={openCommandMenu} />
                        </div>
                        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
                            <AdminNavList collapsed={false} onItemClick={handleMenuItemClick} />
                        </div>
                        <div className="border-t border-sidebar-border px-3 py-3">
                            {accountMenu(false)}
                        </div>
                    </DialogPrimitive.Content>
                </DialogPrimitive.Portal>
            </DialogPrimitive.Root>

            <AdminCommandMenu open={isCommandOpen} onOpenChange={setIsCommandOpen} />

            <div className="flex min-w-0 flex-1 flex-col">
                <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background/85 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/70 md:px-6">
                    <Button
                        ref={mobileNavTriggerRef}
                        variant="ghost"
                        size="icon-sm"
                        className="lg:hidden"
                        onClick={() => setMobileNavPath(routeLocation.pathname)}
                        aria-label="Open navigation"
                        aria-expanded={isMobileNavOpen}
                    >
                        <List />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        className="hidden text-muted-foreground lg:inline-flex"
                        onClick={toggleSidebar}
                        aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                        aria-keyshortcuts={IS_MAC ? 'Meta+B' : 'Control+B'}
                        {...getAnalyticsDebugAttributes('admin__menu--collapse_toggle')}
                    >
                        <SidebarSimple />
                    </Button>
                    <div className="mx-1 hidden h-4 w-px bg-border lg:block" aria-hidden="true" />
                    <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
                        <ol className="flex min-w-0 items-center gap-1.5 text-sm">
                            <li className="hidden text-muted-foreground sm:block">Admin</li>
                            {breadcrumbs.map((crumb, index) => {
                                const isLast = index === breadcrumbs.length - 1;
                                return (
                                    <li
                                        key={crumb}
                                        className={cn('flex min-w-0 items-center gap-1.5', !isLast && 'hidden sm:flex')}
                                    >
                                        <CaretRight className="hidden size-3 shrink-0 text-muted-foreground/70 sm:block rtl:rotate-180" aria-hidden="true" />
                                        <span
                                            className={cn('truncate', isLast ? 'font-medium text-foreground' : 'text-muted-foreground')}
                                            aria-current={isLast ? 'page' : undefined}
                                        >
                                            {crumb}
                                        </span>
                                    </li>
                                );
                            })}
                        </ol>
                    </nav>
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-muted-foreground lg:hidden"
                        onClick={openCommandMenu}
                        aria-label="Search admin"
                    >
                        <MagnifyingGlass />
                    </Button>
                    <ThemeToggle analyticsSurface="admin" />
                </header>

                <main className="flex-1" data-tf-handoff-ready="true">
                    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 px-4 py-6 md:px-6 lg:px-8">
                        {isSimulatedDebugLoginActive && (
                            <Alert variant="warning">
                                <Flask />
                                <AlertTitle>Simulated login is on — this page shows mock data</AlertTitle>
                                <AlertDescription>
                                    <p>
                                        The browser debug toggle <code className="font-mono text-xs">{SIMULATED_LOGIN_STORAGE_KEY}=1</code> is set. Turn it off and reload to see live records.
                                    </p>
                                    <Button variant="outline" size="xs" className="mt-2" onClick={handleDisableSimulatedLogin}>
                                        Turn off simulated login
                                    </Button>
                                </AlertDescription>
                            </Alert>
                        )}

                        {!isSimulatedDebugLoginActive && isDevAdminBypassActive && (
                            <Alert variant="info">
                                <Info />
                                <AlertTitle>Dev admin bypass is active in this tab</AlertTitle>
                                <AlertDescription>
                                    This session uses the local dev-admin identity instead of your real account, so live admin data is not available.
                                </AlertDescription>
                            </Alert>
                        )}

                        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                            <div className="min-w-0">
                                <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
                                {description && (
                                    <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{description}</p>
                                )}
                            </div>
                            {hasToolbar && (
                                <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center xl:w-auto xl:flex-nowrap xl:justify-end">
                                    {showGlobalSearch && (
                                        <SearchInput
                                            id="admin-global-search"
                                            aria-label="Search"
                                            placeholder="Search"
                                            value={searchValue}
                                            onChange={(event) => onSearchValueChange?.(event.currentTarget.value)}
                                            onClear={onSearchValueChange ? () => onSearchValueChange('') : undefined}
                                            disabled={!onSearchValueChange}
                                            containerClassName="h-9 w-full sm:w-64"
                                        />
                                    )}
                                    {showDateRange && (
                                        <Select
                                            value={dateRange}
                                            onValueChange={(next) => onDateRangeChange?.(next as AdminDateRange)}
                                            disabled={!onDateRangeChange}
                                        >
                                            <SelectTrigger className="h-9 w-full sm:w-40" aria-label="Date range">
                                                <SelectValue placeholder="Date range" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {DATE_RANGE_OPTIONS.map((option) => (
                                                    <SelectItem key={option.value} value={option.value}>
                                                        {option.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    )}
                                    {actions && (
                                        <div className="flex shrink-0 flex-wrap items-center gap-2">
                                            {actions}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="min-w-0">
                            {children}
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
};
