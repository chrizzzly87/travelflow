import React from 'react';
import { MarketingLayout } from '../components/marketing/MarketingLayout';
import { WipPlaceholder } from '../components/marketing/WipPlaceholder';

export const LoginPage: React.FC = () => {
    return (
        <MarketingLayout>
            <WipPlaceholder
                title="Login"
                description="Authentication and account/paywall access controls are planned. This placeholder route is in place so navigation and future auth wiring are stable."
            />
        </MarketingLayout>
    );
};
