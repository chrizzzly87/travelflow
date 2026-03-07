import React from 'react';
import { useTranslation } from 'react-i18next';

const SHELL_COLUMNS = [0, 1, 2, 3, 4];
const SHELL_CARDS = [0, 1, 2, 3];

type TripRouteLoadingShellVariant =
    | 'loadingTrip'
    | 'preparingPlanner'
    | 'loadingSharedTrip'
    | 'preparingSharedPlanner'
    | 'loadingExampleTrip'
    | 'preparingExamplePlanner';

interface TripRouteLoadingShellProps {
    variant?: TripRouteLoadingShellVariant;
}

export const TripRouteLoadingShell: React.FC<TripRouteLoadingShellProps> = ({
    variant = 'loadingTrip',
}) => {
    const { t } = useTranslation('common');
    const contextLabel = t(`tripRouteShell.${variant}`);

    return (
        <div
            className="flex min-h-screen w-full flex-col bg-white text-slate-900"
            data-testid="trip-route-loading-shell"
            aria-busy="true"
            aria-label={contextLabel}
        >
            <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 px-4 sm:px-6">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-600 text-sm font-black text-white shadow-sm">
                        TF
                    </div>
                    <div className="space-y-2">
                        <div className="h-4 w-32 rounded-full bg-slate-200" />
                        <div className="h-3 w-24 rounded-full bg-slate-100" />
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="h-10 w-10 rounded-xl bg-slate-100" />
                    <div className="h-10 w-10 rounded-xl bg-slate-100" />
                    <div className="hidden h-10 w-28 rounded-xl bg-slate-100 sm:block" />
                </div>
            </header>

            <div className="border-b border-amber-200 bg-amber-50/70 px-4 py-3 text-sm font-medium text-amber-900 sm:px-6">
                {contextLabel}...
            </div>

            <main className="flex flex-1 flex-col overflow-hidden">
                <section className="grid grid-cols-5 border-b border-slate-200 bg-white">
                    {SHELL_COLUMNS.map((column) => (
                        <div key={column} className="min-h-20 border-r border-slate-100 px-3 py-4 last:border-r-0 sm:px-5">
                            <div className="h-3 w-12 rounded-full bg-slate-200" />
                            <div className="mt-3 h-7 w-16 rounded-full bg-slate-100" />
                        </div>
                    ))}
                </section>

                <section className="flex-1 overflow-hidden bg-white px-4 py-5 sm:px-6 sm:py-6">
                    <div className="grid h-full gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
                        <div className="min-h-[420px] rounded-3xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
                            <div className="mb-4 flex items-center justify-between">
                                <div className="h-4 w-28 rounded-full bg-slate-200" />
                                <div className="h-9 w-32 rounded-full bg-white shadow-sm" />
                            </div>
                            <div className="space-y-4">
                                {SHELL_CARDS.map((card) => (
                                    <div key={card} className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="min-w-0 flex-1 space-y-3">
                                                <div className="h-6 w-40 rounded-full bg-slate-200" />
                                                <div className="h-4 w-full max-w-xl rounded-full bg-slate-100" />
                                                <div className="h-4 w-3/4 rounded-full bg-slate-100" />
                                            </div>
                                            <div className="h-10 w-20 rounded-full bg-accent-50" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <aside className="hidden min-h-[420px] rounded-3xl border border-slate-200 bg-slate-50/80 p-5 lg:block">
                            <div className="space-y-4">
                                <div className="h-5 w-28 rounded-full bg-slate-200" />
                                <div className="aspect-[4/5] rounded-2xl border border-slate-200 bg-white shadow-sm" />
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="h-16 rounded-2xl border border-slate-200 bg-white" />
                                    <div className="h-16 rounded-2xl border border-slate-200 bg-white" />
                                </div>
                            </div>
                        </aside>
                    </div>
                </section>
            </main>
        </div>
    );
};
