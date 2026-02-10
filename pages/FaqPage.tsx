import React from 'react';
import { MarketingLayout } from '../components/marketing/MarketingLayout';
import { WipPlaceholder } from '../components/marketing/WipPlaceholder';

export const FaqPage: React.FC = () => {
    return (
        <MarketingLayout>
            <WipPlaceholder
                title="FAQ"
                description="The full FAQ is currently in progress. For now, account activation and anonymous-trip access limits are described on the Pricing page while we prepare the complete help center."
            />
        </MarketingLayout>
    );
};
