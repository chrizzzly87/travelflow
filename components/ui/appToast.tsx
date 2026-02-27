import React from 'react';
import {
  CheckCircle,
  CircleNotch,
  FloppyDisk,
  Info,
  PencilSimple,
  Trash,
  WarningCircle,
  XCircle,
} from '@phosphor-icons/react';
import { toast, type ExternalToast } from 'sonner';

export type AppToastTone =
  | 'success'
  | 'error'
  | 'info'
  | 'warning'
  | 'loading'
  | 'add'
  | 'remove'
  | 'update'
  | 'neutral';

interface AppToastOptions {
  id?: string | number;
  tone?: AppToastTone;
  title: string;
  description?: string;
  duration?: number;
  dismissible?: boolean;
}

interface AppToastToneMeta {
  Icon: React.ComponentType<{ size?: number; className?: string }>;
  borderClass: string;
  iconWrapClass: string;
  titleClass: string;
}

const TONE_META: Record<AppToastTone, AppToastToneMeta> = {
  success: {
    Icon: CheckCircle,
    borderClass: 'border-emerald-200',
    iconWrapClass: 'bg-emerald-100 text-emerald-700',
    titleClass: 'text-emerald-800',
  },
  error: {
    Icon: XCircle,
    borderClass: 'border-rose-200',
    iconWrapClass: 'bg-rose-100 text-rose-700',
    titleClass: 'text-rose-800',
  },
  info: {
    Icon: Info,
    borderClass: 'border-slate-200',
    iconWrapClass: 'bg-slate-100 text-slate-700',
    titleClass: 'text-slate-800',
  },
  warning: {
    Icon: WarningCircle,
    borderClass: 'border-amber-200',
    iconWrapClass: 'bg-amber-100 text-amber-700',
    titleClass: 'text-amber-800',
  },
  loading: {
    Icon: CircleNotch,
    borderClass: 'border-accent-200',
    iconWrapClass: 'bg-accent-100 text-accent-700',
    titleClass: 'text-accent-800',
  },
  add: {
    Icon: CheckCircle,
    borderClass: 'border-emerald-200',
    iconWrapClass: 'bg-emerald-100 text-emerald-700',
    titleClass: 'text-emerald-800',
  },
  remove: {
    Icon: Trash,
    borderClass: 'border-rose-200',
    iconWrapClass: 'bg-rose-100 text-rose-700',
    titleClass: 'text-rose-800',
  },
  update: {
    Icon: PencilSimple,
    borderClass: 'border-accent-200',
    iconWrapClass: 'bg-accent-100 text-accent-700',
    titleClass: 'text-accent-800',
  },
  neutral: {
    Icon: FloppyDisk,
    borderClass: 'border-slate-200',
    iconWrapClass: 'bg-slate-100 text-slate-700',
    titleClass: 'text-slate-800',
  },
};

export const showAppToast = ({
  id,
  tone = 'info',
  title,
  description,
  duration,
  dismissible = true,
}: AppToastOptions): string | number => {
  const meta = TONE_META[tone];
  const resolvedDuration = duration ?? (tone === 'loading' ? Infinity : 3200);
  const Icon = meta.Icon;
  const options: ExternalToast = {
    id,
    description,
    duration: resolvedDuration,
    dismissible,
    position: 'bottom-right',
    className: `border bg-white/95 text-slate-900 shadow-xl backdrop-blur ${meta.borderClass}`,
    icon: <Icon size={18} className={tone === 'loading' ? `animate-spin ${meta.titleClass}` : meta.titleClass} />,
  };

  if (tone === 'loading') {
    return toast.loading(title, options);
  }
  if (tone === 'error' || tone === 'remove') {
    return toast.error(title, options);
  }
  if (tone === 'warning' || tone === 'neutral') {
    return toast.warning(title, options);
  }
  if (tone === 'success' || tone === 'add') {
    return toast.success(title, options);
  }
  if (tone === 'update') {
    return toast.info(title, options);
  }
  return toast.info(title, options);
};

export const dismissAppToast = (id?: string | number): string | number => toast.dismiss(id);
