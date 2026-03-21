import React from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '../../ui/badge';

interface TripWorkspacePlannerPageProps {
    plannerPage: React.ReactNode;
}

export const TripWorkspacePlannerPage: React.FC<TripWorkspacePlannerPageProps> = ({ plannerPage }) => {
    const { t } = useTranslation('common');

    return (
        <div className="flex h-full min-h-0 flex-col bg-transparent">
            <div className="border-b border-border/70 bg-background/95 px-4 py-4 backdrop-blur sm:px-6">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="secondary">{t('tripView.workspace.pages.planner.eyebrow')}</Badge>
                            <Badge variant="outline">Editing workspace</Badge>
                        </div>
                        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
                            {t('tripView.workspace.pages.planner.title')}
                        </h2>
                        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                            {t('tripView.workspace.pages.planner.description')}
                        </p>
                    </div>
                    <p className="max-w-xs text-xs leading-5 text-muted-foreground">
                        {t('tripView.workspace.pages.planner.hint')}
                    </p>
                </div>
            </div>
            <div className="min-h-0 flex-1">{plannerPage}</div>
        </div>
    );
};

