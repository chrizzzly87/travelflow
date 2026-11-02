import { ArrowUp } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

const Bar: React.FC<{ className: string }> = ({ className }) => (
    <span className={`block rounded-full bg-secondary motion-safe:animate-pulse ${className}`} />
);

/**
 * Stands in for the chat while it loads, shaped like the real one so nothing
 * jumps when it arrives: a quiet conversation area and a prompt field that is
 * visibly not ready yet.
 */
export const TripAgentChatSkeleton: React.FC = () => {
    const { t } = useTranslation('tripAgent');
    return (
        <div className="flex min-h-0 flex-1 flex-col" aria-busy="true" data-testid="trip-agent-chat-skeleton">
            <p role="status" className="sr-only">{t('loading')}</p>
            <div aria-hidden="true" className="flex min-h-0 flex-1 flex-col gap-5 px-4 py-5">
                <div className="flex flex-col items-center gap-3 pt-6">
                    <span className="size-10 rounded-full bg-secondary motion-safe:animate-pulse" />
                    <Bar className="h-3 w-40" />
                    <Bar className="h-2.5 w-56" />
                </div>
                <div className="space-y-2 rounded-xl border border-border p-3">
                    <Bar className="h-3 w-1/3" />
                    <Bar className="h-2.5 w-4/5" />
                    <Bar className="h-2.5 w-2/3" />
                </div>
            </div>
            <div aria-hidden="true" className="border-t border-border bg-card/95 p-3">
                <div className="rounded-xl border border-border bg-background/60 p-3">
                    <p className="min-h-10 text-sm text-muted-foreground/70">{t('placeholder')}</p>
                    <div className="flex items-center justify-between">
                        <div className="flex gap-1">
                            <span className="size-7 rounded-md bg-secondary" />
                            <span className="size-7 rounded-md bg-secondary" />
                        </div>
                        <span className="flex size-8 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                            <ArrowUp className="size-4" />
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};
