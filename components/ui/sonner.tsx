import React from 'react';
import { Toaster as Sonner, type ToasterProps } from 'sonner';

export const Toaster: React.FC<ToasterProps> = (props) => {
  return (
    <Sonner
      position="bottom-right"
      offset={14}
      closeButton={false}
      toastOptions={{
        className: 'border border-border bg-card/95 text-foreground shadow-lg backdrop-blur supports-[backdrop-filter]:bg-card/90 dark:shadow-none',
        classNames: {
          icon: '!h-8 !w-8 !me-2 !shrink-0',
        },
        // Sonner takes this as an inline style, so it cannot carry a dark:
        // variant — it has to read the tokens directly or the toast action stays
        // a light button on a dark toast.
        actionButtonStyle: {
          background: 'var(--secondary)',
          color: 'var(--foreground)',
          border: '1px solid var(--border)',
          fontWeight: 600,
        },
      }}
      {...props}
    />
  );
};
