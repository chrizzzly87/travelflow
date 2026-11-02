import React from 'react';
import { ArrowsClockwise } from '@phosphor-icons/react';

import { Button } from '../ui/button';
import { cn } from '../../lib/utils';

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
    <Button
        type="button"
        variant="outline"
        onClick={onClick}
        disabled={disabled || isLoading}
        aria-busy={isLoading || undefined}
        className={cn('h-9', className)}
    >
        <ArrowsClockwise className={cn('size-4', isLoading && 'animate-spin')} />
        {label}
    </Button>
);
