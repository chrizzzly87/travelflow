import React from 'react';
import { SpinnerGap, Warning } from '@phosphor-icons/react';
import { Alert, AlertDescription } from '../../ui/alert';
import { cn } from '../../../lib/utils';

export const AuditDetailRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
    <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] items-baseline gap-3 py-1.5 text-sm">
        <dt className="text-muted-foreground">{label}</dt>
        <dd className="min-w-0 break-words text-foreground">{children}</dd>
    </div>
);

export const AuditSnapshotDisclosure: React.FC<{ snapshot: Record<string, unknown> }> = ({ snapshot }) => (
    <details className="rounded-md border border-border text-xs text-muted-foreground">
        <summary className="cursor-pointer px-3 py-2 font-medium text-foreground">Audit snapshot (JSON)</summary>
        <pre className="max-h-64 overflow-auto whitespace-pre-wrap border-t border-border bg-slate-800 p-3 font-mono text-[11px] text-slate-100 dark:bg-slate-950">
            {JSON.stringify(snapshot, null, 2)}
        </pre>
    </details>
);

/** Status and tag pill used for action, target and facet badges. */
export const AuditPill: React.FC<{
    className: string;
    size?: 'sm' | 'xs';
    tooltip?: string;
    truncate?: boolean;
    children: React.ReactNode;
}> = ({ className, size = 'sm', tooltip, truncate = false, children }) => (
    <span
        className={cn(
            'inline-flex rounded-full border px-2 py-0.5 font-medium',
            size === 'sm' ? 'text-xs' : 'text-[11px]',
            truncate && 'max-w-full items-center truncate',
            className,
        )}
        data-tooltip={tooltip}
    >
        {children}
    </span>
);

export const AuditWarningAlert: React.FC<{ message: string }> = ({ message }) => (
    <Alert variant="warning">
        <Warning weight="fill" />
        <AlertDescription>
            <p>{message}</p>
        </AlertDescription>
    </Alert>
);

export const AuditLoadingStatus: React.FC<{ label: string }> = ({ label }) => (
    <div role="status" className="inline-flex items-center gap-2 text-sm text-muted-foreground">
        <SpinnerGap size={14} className="animate-spin" />
        {label}
    </div>
);
