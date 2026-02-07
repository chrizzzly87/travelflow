import React from 'react';
import { MarketingLayout } from '../components/marketing/MarketingLayout';
import { WipPlaceholder } from '../components/marketing/WipPlaceholder';

export const FeaturesPage: React.FC = () => {
    return (
        <MarketingLayout>
            <WipPlaceholder
                title="Features"
                description="This will become the detailed product capability page. For now, use the home page and updates page for the latest feature highlights."
            />
        </MarketingLayout>
    );
};
