import * as React from 'react';
import { Drawer as DrawerPrimitive } from 'vaul';

export const Drawer = DrawerPrimitive.Root;
export const DrawerTrigger = DrawerPrimitive.Trigger;
export const DrawerPortal = DrawerPrimitive.Portal;
export const DrawerClose = DrawerPrimitive.Close;
export const DrawerHandle = DrawerPrimitive.Handle;

export const DrawerOverlay = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Overlay
    ref={ref}
    className={`fixed inset-0 z-[1600] bg-black/45 ${className ?? ''}`.trim()}
    {...props}
  />
));
DrawerOverlay.displayName = DrawerPrimitive.Overlay.displayName;

export const DrawerContent = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Content> & {
    hideOverlay?: boolean;
    accessibleTitle?: string;
    accessibleDescription?: string;
    side?: 'bottom' | 'right';
  }
>(({ className, children, hideOverlay = false, accessibleTitle = 'Details panel', accessibleDescription = 'Panel content and controls.', side = 'bottom', ...props }, ref) => (
  <DrawerPortal>
    {!hideOverlay && <DrawerOverlay />}
    <DrawerPrimitive.Content
      ref={ref}
      className={[
        'z-[1601] border border-gray-200 bg-white shadow-2xl focus:outline-none',
        side === 'right'
          ? 'fixed inset-y-0 right-0 h-screen w-[min(96vw,680px)] rounded-none border-l'
          : 'fixed inset-x-0 bottom-0 mt-24 rounded-t-[18px]',
        className ?? '',
      ].join(' ')}
      {...props}
    >
      <DrawerPrimitive.Title className="sr-only">{accessibleTitle}</DrawerPrimitive.Title>
      <DrawerPrimitive.Description className="sr-only">{accessibleDescription}</DrawerPrimitive.Description>
      {side === 'bottom' && (
        <DrawerPrimitive.Handle className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-gray-300" />
      )}
      {children}
    </DrawerPrimitive.Content>
  </DrawerPortal>
));
DrawerContent.displayName = DrawerPrimitive.Content.displayName;

export const DrawerHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => (
  <div className={`grid gap-1.5 p-4 ${className ?? ''}`.trim()} {...props} />
);

export const DrawerFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => (
  <div className={`mt-auto flex flex-col gap-2 p-4 ${className ?? ''}`.trim()} {...props} />
);

export const DrawerTitle = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Title ref={ref} className={`text-lg font-semibold text-gray-900 ${className ?? ''}`.trim()} {...props} />
));
DrawerTitle.displayName = DrawerPrimitive.Title.displayName;

export const DrawerDescription = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Description ref={ref} className={`text-sm text-gray-500 ${className ?? ''}`.trim()} {...props} />
));
DrawerDescription.displayName = DrawerPrimitive.Description.displayName;
