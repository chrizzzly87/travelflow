import React from 'react';
import { ArrowsClockwise } from '@phosphor-icons/react';

interface AdminReloadButtonProps {
    onClick: () => void;
    isLoading?: boolean;
    label?: string;
    disabled?: boolean;
    className?: string;
}

export const AdminReloadButton: React.FC<AdminReloadButtonProps> = ({
    onClick,
    isLoading = false,
    label = 'Reload',
    disabled = false,
    className,
}) => (
    <button
        type="button"
        onClick={onClick}
        disabled={disabled || isLoading}
        className={[
            'inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-lg border border-border bg-card px-3 text-sm font-semibold text-foreground transition-colors',
            'hover:border-slate-400 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60',
            className ?? '',
        ].join(' ')}
    >
        <ArrowsClockwise size={14} className={isLoading ? 'animate-spin' : ''} />
        {label}
    </button>
);
