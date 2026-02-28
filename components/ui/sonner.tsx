import React from 'react';
import { Toaster as Sonner, type ToasterProps } from 'sonner';

export const Toaster: React.FC<ToasterProps> = (props) => {
  return (
    <Sonner
      position="bottom-right"
      offset={14}
      closeButton={false}
      toastOptions={{
        className: 'border border-slate-200 bg-white/95 text-slate-900 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-white/90',
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
