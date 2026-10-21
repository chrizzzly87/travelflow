import React from 'react';
import { Toaster as Sonner, type ToasterProps } from 'sonner';
import { useTheme } from '../../contexts/theme/useTheme';

export const Toaster: React.FC<ToasterProps> = (props) => {
  // Sonner defaults to its light theme regardless of the page, which left a
  // white toast behind dark-mode title and icon colours.
  const { resolvedTheme } = useTheme();

  return (
    <Sonner
      theme={resolvedTheme}
      position="bottom-right"
      offset={14}
      closeButton={false}
      toastOptions={{
        className: 'border shadow-lg dark:shadow-none',
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
