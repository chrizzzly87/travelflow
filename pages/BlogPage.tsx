import React from 'react';
import { MarketingLayout } from '../components/marketing/MarketingLayout';
import { WipPlaceholder } from '../components/marketing/WipPlaceholder';

export const BlogPage: React.FC = () => {
    return (
        <MarketingLayout>
            <WipPlaceholder
                title="Blog"
                description="The blog section is scaffolded and will host long-form travel planning content, product deep dives, and launch stories."
            />
        </MarketingLayout>
    );
};
