import React from 'react';

const tones = {
    amber: {
        surface: 'border-amber-200/70 bg-amber-50/90 shadow-sm dark:bg-amber-400/12 dark:border-amber-400/30',
        message: 'text-amber-900 dark:text-amber-200',
    },
    cyan: {
        surface: 'border-cyan-200/60 bg-cyan-50/90 shadow-sm dark:shadow-none dark:bg-cyan-400/12 dark:border-cyan-400/30',
        message: 'text-cyan-900 dark:text-cyan-100',
    },
};

interface MarketingNoticeProps {
    tone: keyof typeof tones;
    icon: React.ReactNode;
    message: React.ReactNode;
    action: React.ReactNode;
    dismiss: React.ReactNode;
}

/** Intrinsic notice rows: actions wrap beneath the message on narrow screens. */
export function MarketingNotice({ tone, icon, message, action, dismiss }: MarketingNoticeProps) {
    const colors = tones[tone];
    return <div className={`border-b ${colors.surface}`}>
        <div className="mx-auto grid w-full max-w-7xl grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-2 gap-y-2 px-5 py-2.5 sm:grid-cols-[auto_minmax(0,1fr)_auto_auto] sm:items-center sm:gap-x-3 md:px-8">
            <div className="col-start-1 row-start-1 pt-0.5 sm:pt-0">{icon}</div>
            <p className={`col-start-2 row-start-1 min-w-0 break-words text-[11px] leading-relaxed sm:text-sm ${colors.message}`}>{message}</p>
            <div className="col-span-2 col-start-2 row-start-2 min-w-0 max-w-full sm:col-span-1 sm:col-start-3 sm:row-start-1 sm:max-w-xs">{action}</div>
            <div className="col-start-3 row-start-1 sm:col-start-4">{dismiss}</div>
        </div>
    </div>;
}
