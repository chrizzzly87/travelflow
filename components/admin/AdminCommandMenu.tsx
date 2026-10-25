import React from 'react';
import { useNavigate } from '@/app/navigation';
import { House, Moon, Sun } from '@phosphor-icons/react';

import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
} from '../ui/command';
import { useTheme } from '../../contexts/theme/useTheme';
import { trackEvent } from '../../services/analyticsService';
import { ADMIN_NAV_ITEMS, ADMIN_NAV_SECTIONS } from './adminNavConfig';
import { AdminNavIcon } from './AdminNavIcon';

interface AdminCommandMenuProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

/** ⌘K palette: every admin screen by name or keyword, plus a few global actions. */
export const AdminCommandMenu: React.FC<AdminCommandMenuProps> = ({ open, onOpenChange }) => {
    const navigate = useNavigate();
    const { resolvedTheme, toggle } = useTheme();

    const run = (eventName: `admin__command--${string}`, action: () => void) => {
        trackEvent(eventName);
        onOpenChange(false);
        action();
    };

    return (
        <CommandDialog
            open={open}
            onOpenChange={onOpenChange}
            title="Admin command menu"
            description="Jump to an admin screen or run an action."
            className="top-[18%] translate-y-0"
            showCloseButton={false}
        >
            <CommandInput placeholder="Search admin screens and actions…" />
            <CommandList className="max-h-[min(60dvh,420px)]">
                <CommandEmpty>No matching screen.</CommandEmpty>
                {ADMIN_NAV_SECTIONS.map((section) => {
                    const items = ADMIN_NAV_ITEMS.filter((item) => item.section === section.id);
                    if (items.length === 0) return null;
                    return (
                        <CommandGroup key={section.id} heading={section.label}>
                            {items.map((item) => (
                                <CommandItem
                                    key={item.id}
                                    value={`${item.label} ${section.label}`}
                                    keywords={item.keywords}
                                    onSelect={() => run(`admin__command--${item.id}`, () => navigate(item.path))}
                                >
                                    <AdminNavIcon icon={item.icon} className="size-4 text-muted-foreground" />
                                    <span>{item.label}</span>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    );
                })}
                <CommandSeparator />
                <CommandGroup heading="Actions">
                    <CommandItem
                        value="Toggle theme dark light"
                        onSelect={() => run('admin__command--theme', toggle)}
                    >
                        {resolvedTheme === 'dark'
                            ? <Sun className="size-4 text-muted-foreground" />
                            : <Moon className="size-4 text-muted-foreground" />}
                        <span>{resolvedTheme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}</span>
                    </CommandItem>
                    <CommandItem
                        value="Back to TravelFlow app home"
                        onSelect={() => run('admin__command--app_home', () => navigate('/'))}
                    >
                        <House className="size-4 text-muted-foreground" />
                        <span>Back to TravelFlow</span>
                    </CommandItem>
                </CommandGroup>
            </CommandList>
        </CommandDialog>
    );
};
