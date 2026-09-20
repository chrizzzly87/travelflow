import React from 'react';
import { Toaster as Sonner, type ToasterProps } from 'sonner';

export const Toaster: React.FC<ToasterProps> = (props) => {
  return (
    <Sonner
      position="bottom-right"
      offset={14}
      closeButton={false}
      toastOptions={{
        className: 'border border-border bg-card/95 text-foreground shadow-lg backdrop-blur supports-[backdrop-filter]:bg-card/90',
        classNames: {
          icon: '!h-8 !w-8 !me-2 !shrink-0',
        },
        actionButtonStyle: {
          background: '#f8fafc',
          color: '#0f172a',
          border: '1px solid #cbd5e1',
          fontWeight: 600,
        },
      }}
      {...props}
    />
  );
};
