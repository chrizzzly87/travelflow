import React from 'react';
import { Toaster as Sonner, type ToasterProps } from 'sonner';

export const Toaster: React.FC<ToasterProps> = (props) => {
  return (
    <Sonner
      position="top-center"
      closeButton
      richColors
      toastOptions={{
        className: 'border border-slate-200 bg-white text-slate-900 shadow-lg',
      }}
      {...props}
    />
  );
};

