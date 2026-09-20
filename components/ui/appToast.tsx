import React from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Info,
  LoaderCircle,
  PencilLine,
  Redo2,
  Save,
  Trash2,
  Undo2,
  XCircle,
} from 'lucide-react';
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

interface AppToastAction {
  label: string;
  onClick: () => void;
}

interface AppToastOptions {
  id?: string | number;
  tone?: AppToastTone;
  title: string;
  description?: React.ReactNode;
  duration?: number;
  dismissible?: boolean;
  action?: AppToastAction;
  iconVariant?: 'undo' | 'redo';
}

interface AppToastToneMeta {
  Icon: React.ComponentType<{ size?: number; className?: string }>;
  borderClass: string;
  iconWrapClass: string;
  titleClass: string;
}

const QUOTED_SEGMENT_REGEX = /(".*?"|“.*?”)/g;

const TONE_META: Record<AppToastTone, AppToastToneMeta> = {
  success: {
    Icon: CheckCircle2,
    borderClass: 'border-emerald-200 dark:border-emerald-400/30',
    iconWrapClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-400/12 dark:text-emerald-200',
    titleClass: 'text-emerald-800 dark:text-emerald-200',
  },
  error: {
    Icon: XCircle,
    borderClass: 'border-rose-200 dark:border-rose-400/30',
    iconWrapClass: 'bg-rose-100 text-rose-700 dark:bg-rose-400/12 dark:text-rose-200',
    titleClass: 'text-rose-800 dark:text-rose-200',
  },
  info: {
    Icon: Info,
    borderClass: 'border-sky-200 dark:border-sky-400/30',
    iconWrapClass: 'bg-sky-100 text-sky-700 dark:bg-sky-400/12 dark:text-sky-200',
    titleClass: 'text-sky-800 dark:text-sky-200',
  },
  warning: {
    Icon: AlertCircle,
    borderClass: 'border-amber-200 dark:border-amber-400/30',
    iconWrapClass: 'bg-amber-100 text-amber-700 dark:bg-amber-400/12 dark:text-amber-200',
    titleClass: 'text-amber-800 dark:text-amber-200',
  },
  loading: {
    Icon: LoaderCircle,
    borderClass: 'border-accent-200 dark:border-accent-400/30',
    iconWrapClass: 'bg-accent-100 text-accent-700 dark:bg-accent-400/12 dark:text-accent-200',
    titleClass: 'text-accent-800 dark:text-accent-200',
  },
  add: {
    Icon: CheckCircle2,
    borderClass: 'border-emerald-200 dark:border-emerald-400/30',
    iconWrapClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-400/12 dark:text-emerald-200',
    titleClass: 'text-emerald-800 dark:text-emerald-200',
  },
  remove: {
    Icon: Trash2,
    borderClass: 'border-rose-200 dark:border-rose-400/30',
    iconWrapClass: 'bg-rose-100 text-rose-700 dark:bg-rose-400/12 dark:text-rose-200',
    titleClass: 'text-rose-800 dark:text-rose-200',
  },
  update: {
    Icon: PencilLine,
    borderClass: 'border-accent-200 dark:border-accent-400/30',
    iconWrapClass: 'bg-accent-100 text-accent-700 dark:bg-accent-400/12 dark:text-accent-200',
    titleClass: 'text-accent-800 dark:text-accent-200',
  },
  neutral: {
    Icon: Save,
    borderClass: 'border-border',
    iconWrapClass: 'bg-secondary text-foreground',
    titleClass: 'text-foreground',
  },
};

export const showAppToast = ({
  id,
  tone = 'info',
  title,
  description,
  duration,
  dismissible = true,
  action,
  iconVariant,
}: AppToastOptions): string | number => {
  const normalizedTitle = title.trim().replace(/\.+$/u, '') || title;
  const meta = TONE_META[tone];
  const resolvedDuration = duration ?? (tone === 'loading' ? Infinity : 3200);
  const ToneIcon = meta.Icon;
  const Icon = iconVariant === 'undo' ? Undo2 : iconVariant === 'redo' ? Redo2 : ToneIcon;
  const titleNode = <span className={`font-semibold ${meta.titleClass}`}>{normalizedTitle}</span>;
  const resolvedDescription = typeof description === 'string'
    ? (() => {
      const seenKeys = new Map<string, number>();
      return description.split(QUOTED_SEGMENT_REGEX).map((segment) => {
        if (!segment) return null;
        const normalizedKey = segment.startsWith('"') || segment.startsWith('“')
          ? `quoted:${segment}`
          : `text:${segment}`;
        const nextCount = (seenKeys.get(normalizedKey) || 0) + 1;
        seenKeys.set(normalizedKey, nextCount);
        const key = `${normalizedKey}:${nextCount}`;

        if (segment.startsWith('"') || segment.startsWith('“')) {
          return <span key={key} className="font-semibold">{segment}</span>;
        }
        return <React.Fragment key={key}>{segment}</React.Fragment>;
      });
    })()
    : description;
  const options: ExternalToast = {
    id,
    description: resolvedDescription,
    duration: resolvedDuration,
    dismissible,
    action,
    position: 'bottom-right',
    className: `border bg-card/95 text-foreground shadow-xl backdrop-blur supports-[backdrop-filter]:bg-white/90 ${meta.borderClass}`,
    icon: (
      <span className={`inline-flex size-8 items-center justify-center rounded-full ${meta.iconWrapClass}`}>
        <Icon size={20} className={tone === 'loading' && !iconVariant ? 'animate-spin' : undefined} />
      </span>
    ),
  };

  return toast(titleNode, options);
};

export const dismissAppToast = (id?: string | number): string | number => toast.dismiss(id);
