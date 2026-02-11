import React from 'react';
import { MarketingLayout } from '../components/marketing/MarketingLayout';
import { WipPlaceholder } from '../components/marketing/WipPlaceholder';

export const LoginPage: React.FC = () => {
    return (
        <MarketingLayout>
            <WipPlaceholder
                title="Login"
                description="Account access is rolling out soon. Login will unlock premium features, longer trip history, and smoother paywall upgrade flows."
            />
        </MarketingLayout>
    );
};
