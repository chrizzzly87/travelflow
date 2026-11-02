import React from 'react';
import { CaretLeft, CaretRight } from '@phosphor-icons/react';

import { Button } from '../ui/button';
import { cn } from '../../lib/utils';

interface AdminPaginationProps {
    /** 1-based current page. */
    page: number;
    pageSize: number;
    totalItems: number;
    onPageChange: (page: number) => void;
    /** Plural noun for the range label ("users", "entries"). */
    noun?: string;
    className?: string;
}

/** "Showing 51–100 of 240" with previous/next, for client-paged admin tables. */
export const AdminPagination: React.FC<AdminPaginationProps> = ({
    page,
    pageSize,
    totalItems,
    onPageChange,
    noun = 'rows',
    className,
}) => {
    const pageCount = Math.max(1, Math.ceil(totalItems / pageSize));
    const safePage = Math.min(Math.max(page, 1), pageCount);
    const first = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
    const last = Math.min(safePage * pageSize, totalItems);

    return (
        <nav
            aria-label="Pagination"
            className={cn('flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground', className)}
        >
            <span className="tabular-nums" aria-live="polite">
                {totalItems === 0
                    ? `No ${noun}`
                    : `Showing ${first.toLocaleString()}–${last.toLocaleString()} of ${totalItems.toLocaleString()} ${noun}`}
            </span>
            {pageCount > 1 && (
                <div className="flex items-center gap-1">
                    <span className="me-2 tabular-nums">Page {safePage} of {pageCount}</span>
                    <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        onClick={() => onPageChange(safePage - 1)}
                        disabled={safePage <= 1}
                        aria-label="Previous page"
                    >
                        <CaretLeft className="rtl:rotate-180" />
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        onClick={() => onPageChange(safePage + 1)}
                        disabled={safePage >= pageCount}
                        aria-label="Next page"
                    >
                        <CaretRight className="rtl:rotate-180" />
                    </Button>
                </div>
            )}
        </nav>
    );
};
