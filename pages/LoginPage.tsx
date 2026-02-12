import React from 'react';
import { useTranslation } from 'react-i18next';
import { MarketingLayout } from '../components/marketing/MarketingLayout';
import { WipPlaceholder } from '../components/marketing/WipPlaceholder';

export const LoginPage: React.FC = () => {
    const { t } = useTranslation('wip');

    return (
        <MarketingLayout>
            <WipPlaceholder
                title={t('login.title')}
                description={t('login.description')}
            />
        </MarketingLayout>
    );
};
