import React from 'react';
import { useTranslation } from 'react-i18next';

import type { TripWorkspacePage } from '../../../types';
import { Badge } from '../../ui/badge';

interface TripWorkspacePageShellProps {
    page: TripWorkspacePage;
    title: string;
    description: string;
    children: React.ReactNode;
    aside?: React.ReactNode;
}

export const TripWorkspacePageShell: React.FC<TripWorkspacePageShellProps> = ({
    page,
    title,
    description,
    children,
    aside,
}) => {
    const { t } = useTranslation('common');

    return (
        <div className="flex h-full min-h-0 flex-col bg-transparent">
            <div className="sticky top-0 z-20 border-b border-border/70 bg-background/95 px-4 py-4 backdrop-blur sm:px-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline">{t('tripView.workspace.demoBadge')}</Badge>
                            <Badge variant="secondary">{t(`tripView.workspace.pages.${page}.eyebrow`)}</Badge>
                        </div>
                        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">{title}</h2>
                        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p>
                    </div>
                    <div className="flex max-w-sm flex-col items-start gap-2 text-xs leading-5 text-muted-foreground">
                        <p>{t('tripView.workspace.demoHint')}</p>
                        {aside}
                    </div>
                </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
                {children}
            </div>
        </div>
    );
};
