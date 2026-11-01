import React, { useState } from 'react';
import { CalendarBlank, Copy, MapPin, PencilSimple, Share, Trash } from '@phosphor-icons/react';

import { AppModal } from '../../ui/app-modal';
import { showAppToast } from '../../ui/appToast';
import { Button } from '../../ui/button';
import {
    Command,
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
    CommandShortcut,
} from '../../ui/command';
import {
    Dialog,
    DialogBody,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    type DialogSize,
} from '../../ui/dialog';
import {
    Drawer,
    DrawerClose,
    DrawerContent,
    DrawerDescription,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle,
    DrawerTrigger,
} from '../../ui/drawer';
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSeparator,
    DropdownMenuShortcut,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from '../../ui/dropdown-menu';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '../../ui/hover-card';
import type { CanvasGroupDefinition } from './ComponentCanvas';
import { CanvasRow, CanvasRows, CanvasSlot } from './canvasFrame';
import { APP_MODAL_SIZES, DIALOG_SIZES, POPOVER_SIDES, TOAST_TONES } from './canvasCatalog';

/** Every portal example opens from the same trigger, so only the compared prop differs. */
const TRIGGER_LABEL = 'Open';

const LONG_BODY = Array.from({ length: 14 }, (_, index) => `Day ${index + 1}: a walk, a long lunch and an early night.`);

// --- DropdownMenu ------------------------------------------------------------

const MenuTrigger = React.forwardRef<HTMLButtonElement, React.ComponentProps<typeof Button>>((props, ref) => (
    <Button ref={ref} variant="outline" {...props}>{TRIGGER_LABEL}</Button>
));
MenuTrigger.displayName = 'MenuTrigger';

const BasicMenuItems: React.FC = () => (
    <>
        <DropdownMenuLabel>Trip</DropdownMenuLabel>
        <DropdownMenuGroup>
            <DropdownMenuItem><PencilSimple />Rename<DropdownMenuShortcut>⌘R</DropdownMenuShortcut></DropdownMenuItem>
            <DropdownMenuItem><Copy />Duplicate</DropdownMenuItem>
            <DropdownMenuItem disabled><Share />Share</DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive"><Trash />Delete</DropdownMenuItem>
    </>
);

const SelectionMenuItems: React.FC = () => {
    const [showMap, setShowMap] = useState(true);
    const [showNotes, setShowNotes] = useState(false);
    const [units, setUnits] = useState('km');
    return (
        <>
            <DropdownMenuLabel>View</DropdownMenuLabel>
            <DropdownMenuCheckboxItem checked={showMap} onCheckedChange={setShowMap}>Map</DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={showNotes} onCheckedChange={setShowNotes}>Notes</DropdownMenuCheckboxItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel inset>Units</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={units} onValueChange={setUnits}>
                <DropdownMenuRadioItem value="km">Kilometres</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="mi">Miles</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
        </>
    );
};

const SubMenuItems: React.FC = () => (
    <>
        <DropdownMenuItem><Copy />Duplicate</DropdownMenuItem>
        <DropdownMenuSub>
            <DropdownMenuSubTrigger><Share />Share</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
                <DropdownMenuItem>Copy link</DropdownMenuItem>
                <DropdownMenuItem>Email</DropdownMenuItem>
            </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuItem inset>Inset item</DropdownMenuItem>
    </>
);

const LinkMenuItems: React.FC = () => (
    <>
        <DropdownMenuItem asChild><a href="#canvas-group-dialog">Jump to Dialog group</a></DropdownMenuItem>
        <DropdownMenuItem asChild><a href="/admin/dashboard">Leave the canvas</a></DropdownMenuItem>
    </>
);

const MenuExample: React.FC<{ side?: (typeof POPOVER_SIDES)[number]; children: React.ReactNode }> = ({ side, children }) => (
    <DropdownMenu>
        <DropdownMenuTrigger asChild><MenuTrigger /></DropdownMenuTrigger>
        <DropdownMenuContent side={side} className="w-56">{children}</DropdownMenuContent>
    </DropdownMenu>
);

const DropdownMenuContentGroup: React.FC = () => (
    <CanvasRows>
        <CanvasRow title="composition" minSlotWidth={200}>
            <CanvasSlot label="items, shortcut, disabled, destructive"><MenuExample><BasicMenuItems /></MenuExample></CanvasSlot>
            <CanvasSlot label="checkbox and radio items"><MenuExample><SelectionMenuItems /></MenuExample></CanvasSlot>
            <CanvasSlot label="sub-menu, inset"><MenuExample><SubMenuItems /></MenuExample></CanvasSlot>
            <CanvasSlot label="link items"><MenuExample><LinkMenuItems /></MenuExample></CanvasSlot>
        </CanvasRow>
        <CanvasRow title="side" minSlotWidth={200}>
            {POPOVER_SIDES.map((side) => (
                <CanvasSlot key={side} label={side}><MenuExample side={side}><BasicMenuItems /></MenuExample></CanvasSlot>
            ))}
        </CanvasRow>
    </CanvasRows>
);

// --- HoverCard ---------------------------------------------------------------

const HoverCardExample: React.FC<{ side?: (typeof POPOVER_SIDES)[number] }> = ({ side }) => (
    <HoverCard openDelay={150} closeDelay={100}>
        <HoverCardTrigger asChild>
            <Button variant="link" className="px-0">Lisbon</Button>
        </HoverCardTrigger>
        <HoverCardContent side={side}>
            <div className="flex flex-col gap-1">
                <span className="text-sm font-semibold">Lisbon</span>
                <span className="text-sm text-muted-foreground">3 nights · Alfama, Belém and Bairro Alto.</span>
            </div>
        </HoverCardContent>
    </HoverCard>
);

const HoverCardContentGroup: React.FC = () => (
    <CanvasRows>
        <CanvasRow title="side" minSlotWidth={200}>
            {POPOVER_SIDES.map((side) => (
                <CanvasSlot key={side} label={side}><HoverCardExample side={side} /></CanvasSlot>
            ))}
        </CanvasRow>
    </CanvasRows>
);

// --- Dialog ------------------------------------------------------------------

const DialogExample: React.FC<{
    size?: DialogSize;
    showCloseButton?: boolean;
    divided?: boolean;
    stickyFooter?: boolean;
    longBody?: boolean;
}> = ({ size, showCloseButton, divided, stickyFooter = true, longBody }) => (
    <Dialog>
        <DialogTrigger asChild><Button variant="outline">{TRIGGER_LABEL}</Button></DialogTrigger>
        <DialogContent size={size} showCloseButton={showCloseButton}>
            <DialogHeader divided={divided}>
                <DialogTitle>Rename trip</DialogTitle>
                <DialogDescription>The new name shows everywhere the trip appears.</DialogDescription>
            </DialogHeader>
            <DialogBody>
                {longBody
                    ? <div className="flex flex-col gap-2 text-sm">{LONG_BODY.map((line) => <p key={line}>{line}</p>)}</div>
                    : <p className="text-sm">Lisbon in spring</p>}
            </DialogBody>
            <DialogFooter sticky={stickyFooter}>
                <DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose>
                <DialogClose asChild><Button>Save</Button></DialogClose>
            </DialogFooter>
        </DialogContent>
    </Dialog>
);

const DialogContentGroup: React.FC = () => (
    <CanvasRows>
        <CanvasRow title="size" minSlotWidth={170}>
            {DIALOG_SIZES.map((size) => <CanvasSlot key={size} label={size}><DialogExample size={size} /></CanvasSlot>)}
        </CanvasRow>
        <CanvasRow title="feature" minSlotWidth={170}>
            <CanvasSlot label="default"><DialogExample /></CanvasSlot>
            <CanvasSlot label="showCloseButton"><DialogExample showCloseButton /></CanvasSlot>
            <CanvasSlot label="header divided"><DialogExample divided /></CanvasSlot>
            <CanvasSlot label="footer sticky=false"><DialogExample stickyFooter={false} /></CanvasSlot>
            <CanvasSlot label="scrolling body"><DialogExample divided longBody /></CanvasSlot>
        </CanvasRow>
    </CanvasRows>
);

// --- AppModal ----------------------------------------------------------------

const AppModalExample: React.FC<{
    size?: (typeof APP_MODAL_SIZES)[number];
    mobileSheet?: boolean;
    withFooter?: boolean;
    withDescription?: boolean;
    longBody?: boolean;
}> = ({ size, mobileSheet, withFooter, withDescription = true, longBody }) => {
    const [open, setOpen] = useState(false);
    const close = () => setOpen(false);
    return (
        <>
            <Button variant="outline" onClick={() => setOpen(true)}>{TRIGGER_LABEL}</Button>
            <AppModal
                isOpen={open}
                onClose={close}
                title="Rename trip"
                description={withDescription ? 'The new name shows everywhere the trip appears.' : undefined}
                size={size}
                mobileSheet={mobileSheet}
                footer={withFooter ? (
                    <div className="flex justify-end gap-2">
                        <Button variant="ghost" onClick={close}>Cancel</Button>
                        <Button onClick={close}>Save</Button>
                    </div>
                ) : undefined}
            >
                {longBody
                    ? <div className="flex flex-col gap-2 text-sm">{LONG_BODY.map((line) => <p key={line}>{line}</p>)}</div>
                    : <p className="text-sm">Lisbon in spring</p>}
            </AppModal>
        </>
    );
};

const AppModalContentGroup: React.FC = () => (
    <CanvasRows>
        <CanvasRow title="size" minSlotWidth={170}>
            {APP_MODAL_SIZES.map((size) => <CanvasSlot key={size} label={size}><AppModalExample size={size} /></CanvasSlot>)}
        </CanvasRow>
        <CanvasRow title="feature" minSlotWidth={170}>
            <CanvasSlot label="default"><AppModalExample /></CanvasSlot>
            <CanvasSlot label="footer"><AppModalExample withFooter /></CanvasSlot>
            <CanvasSlot label="no description"><AppModalExample withDescription={false} /></CanvasSlot>
            <CanvasSlot label="mobileSheet=false"><AppModalExample mobileSheet={false} /></CanvasSlot>
            <CanvasSlot label="scrolling body"><AppModalExample withFooter longBody /></CanvasSlot>
        </CanvasRow>
    </CanvasRows>
);

// --- Drawer ------------------------------------------------------------------

const DrawerExample: React.FC<{ side?: 'bottom' | 'right'; hideOverlay?: boolean; visibleTitle?: boolean }> = ({ side, hideOverlay, visibleTitle = true }) => (
    <Drawer direction={side === 'right' ? 'right' : 'bottom'}>
        <DrawerTrigger asChild><Button variant="outline">{TRIGGER_LABEL}</Button></DrawerTrigger>
        <DrawerContent
            side={side}
            hideOverlay={hideOverlay}
            hasVisibleTitle={visibleTitle}
            accessibleTitle="Stop details"
            accessibleDescription="Details for the selected stop."
        >
            {visibleTitle && (
                <DrawerHeader>
                    <DrawerTitle>Lisbon</DrawerTitle>
                    <DrawerDescription>3 nights · Alfama, Belém and Bairro Alto.</DrawerDescription>
                </DrawerHeader>
            )}
            <div className="px-4 pb-2 text-sm text-muted-foreground">
                {!visibleTitle && <p>No visible title; screen readers hear “Stop details”.</p>}
                <p className="flex items-center gap-2"><MapPin className="size-4" />Rua Augusta, Lisbon</p>
            </div>
            <DrawerFooter>
                <DrawerClose asChild><Button variant="outline">Close</Button></DrawerClose>
            </DrawerFooter>
        </DrawerContent>
    </Drawer>
);

const DrawerContentGroup: React.FC = () => (
    <CanvasRows>
        <CanvasRow title="side" minSlotWidth={170}>
            <CanvasSlot label="bottom"><DrawerExample side="bottom" /></CanvasSlot>
            <CanvasSlot label="right"><DrawerExample side="right" /></CanvasSlot>
        </CanvasRow>
        <CanvasRow title="feature" minSlotWidth={170}>
            <CanvasSlot label="default"><DrawerExample /></CanvasSlot>
            <CanvasSlot label="hideOverlay"><DrawerExample hideOverlay /></CanvasSlot>
            <CanvasSlot label="accessible title only"><DrawerExample visibleTitle={false} /></CanvasSlot>
        </CanvasRow>
    </CanvasRows>
);

// --- Command -----------------------------------------------------------------

const CommandItems: React.FC<{ onRun?: () => void }> = ({ onRun }) => (
    <CommandList>
        <CommandEmpty>No matching command.</CommandEmpty>
        <CommandGroup heading="Trip">
            <CommandItem onSelect={onRun}><PencilSimple />Rename<CommandShortcut>⌘R</CommandShortcut></CommandItem>
            <CommandItem onSelect={onRun}><CalendarBlank />Change dates</CommandItem>
            <CommandItem disabled><Share />Share</CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Stops">
            <CommandItem onSelect={onRun}><MapPin />Lisbon</CommandItem>
            <CommandItem onSelect={onRun}><MapPin />Porto</CommandItem>
        </CommandGroup>
    </CommandList>
);

const CommandDialogExample: React.FC = () => {
    const [open, setOpen] = useState(false);
    return (
        <>
            <Button variant="outline" onClick={() => setOpen(true)}>{TRIGGER_LABEL}</Button>
            <CommandDialog open={open} onOpenChange={setOpen}>
                <CommandInput placeholder="Type a command" />
                <CommandItems onRun={() => setOpen(false)} />
            </CommandDialog>
        </>
    );
};

const CommandContentGroup: React.FC = () => (
    <CanvasRows>
        <CanvasRow title="presentation" minSlotWidth={340}>
            <CanvasSlot label="inline Command">
                <Command className="w-full rounded-lg border border-border">
                    <CommandInput placeholder="Type a command" />
                    <CommandItems />
                </Command>
            </CanvasSlot>
            <CanvasSlot label="CommandDialog"><CommandDialogExample /></CanvasSlot>
        </CanvasRow>
    </CanvasRows>
);

// --- Toasts ------------------------------------------------------------------

const ToastContent: React.FC = () => (
    <CanvasRows>
        <CanvasRow title="tone" minSlotWidth={150}>
            {TOAST_TONES.map((tone) => (
                <CanvasSlot key={tone} label={tone}>
                    <Button variant="outline" onClick={() => showAppToast({ tone, title: 'Trip saved', description: 'Your changes to Lisbon are in your library.' })}>
                        Show toast
                    </Button>
                </CanvasSlot>
            ))}
        </CanvasRow>
        <CanvasRow title="feature" minSlotWidth={150}>
            <CanvasSlot label="title only">
                <Button variant="outline" onClick={() => showAppToast({ tone: 'success', title: 'Trip saved' })}>Show toast</Button>
            </CanvasSlot>
            <CanvasSlot label="action">
                <Button
                    variant="outline"
                    onClick={() => showAppToast({ tone: 'remove', title: 'Stop removed', action: { label: 'Undo', onClick: () => undefined } })}
                >
                    Show toast
                </Button>
            </CanvasSlot>
            <CanvasSlot label="iconVariant undo">
                <Button variant="outline" onClick={() => showAppToast({ tone: 'update', title: 'Change undone', iconVariant: 'undo' })}>Show toast</Button>
            </CanvasSlot>
            <CanvasSlot label="iconVariant redo">
                <Button variant="outline" onClick={() => showAppToast({ tone: 'update', title: 'Change redone', iconVariant: 'redo' })}>Show toast</Button>
            </CanvasSlot>
        </CanvasRow>
    </CanvasRows>
);

export const OVERLAY_GROUPS: CanvasGroupDefinition[] = [
    { id: 'dropdown-menu', title: 'DropdownMenu', render: () => <DropdownMenuContentGroup /> },
    { id: 'hover-card', title: 'HoverCard', render: () => <HoverCardContentGroup /> },
    { id: 'dialog', title: 'Dialog', render: () => <DialogContentGroup /> },
    { id: 'app-modal', title: 'AppModal', render: () => <AppModalContentGroup /> },
    { id: 'drawer', title: 'Drawer', render: () => <DrawerContentGroup /> },
    { id: 'command', title: 'Command', render: () => <CommandContentGroup /> },
    { id: 'toast', title: 'Toasts (showAppToast)', render: () => <ToastContent /> },
];
