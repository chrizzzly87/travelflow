import React from 'react';
import { Broom, CreditCard, Hourglass } from '@phosphor-icons/react';
import { Button } from '../../ui/button';
import { AdminStatCard } from '../AdminStatCard';
import { cn } from '../../../lib/utils';
import { getAnalyticsDebugAttributes, trackEvent } from '../../../services/analyticsService';
import { USER_QUEUE_EVENTS, USER_QUEUE_IDS, type UserQueueId } from '../adminUsersModel';
import type { AdminUsersStateApi } from './useAdminUsersState';

const USER_QUEUE_COPY: Record<UserQueueId, { label: string; description: string; icon: React.ReactNode; attention: boolean }> = {
    awaiting_activation: {
        label: 'Awaiting activation',
        description: 'Invited or created, never signed in.',
        icon: <Hourglass />,
        attention: true,
    },
    subscriptions_at_risk: {
        label: 'Subscriptions at risk',
        description: 'Past due, or cancelled and in grace.',
        icon: <CreditCard />,
        attention: true,
    },
    empty_accounts: {
        label: 'Empty accounts',
        description: 'No trips, no profile, never signed in.',
        icon: <Broom />,
        attention: false,
    },
};

/** Work-queue KPI tiles. "Show in table" swaps every filter for the queue's; clicking again clears it. */
export const UsersQueueTiles: React.FC<{ table: AdminUsersStateApi; isLoading: boolean }> = ({ table, isLoading }) => (
    <section aria-label="Accounts that need attention" className="grid gap-4 sm:grid-cols-3">
        {USER_QUEUE_IDS.map((queueId) => {
            const copy = USER_QUEUE_COPY[queueId];
            const count = table.queueCounts[queueId];
            const isApplied = table.appliedQueue === queueId;
            return (
                <AdminStatCard
                    key={queueId}
                    label={copy.label}
                    icon={copy.icon}
                    value={count.toLocaleString()}
                    isLoading={isLoading}
                    className={cn(isApplied && 'border-primary')}
                    hint={(
                        <span className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                            <span className={cn(copy.attention && count > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-muted-foreground')}>
                                {copy.description}
                            </span>
                            {(count > 0 || isApplied) && (
                                <Button
                                    type="button"
                                    variant="link"
                                    size="xs"
                                    className="h-auto p-0"
                                    aria-pressed={isApplied}
                                    onClick={() => {
                                        trackEvent(USER_QUEUE_EVENTS[queueId], { active: !isApplied });
                                        table.actions.applyQueue(queueId);
                                    }}
                                    {...getAnalyticsDebugAttributes(USER_QUEUE_EVENTS[queueId])}
                                >
                                    {isApplied ? 'Clear filter' : 'Show in table'}
                                </Button>
                            )}
                        </span>
                    )}
                />
            );
        })}
    </section>
);
