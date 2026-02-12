import React from 'react';
import { useTranslation } from 'react-i18next';
import { MarketingLayout } from '../components/marketing/MarketingLayout';
import { WipPlaceholder } from '../components/marketing/WipPlaceholder';

export const FaqPage: React.FC = () => {
    const { t } = useTranslation('wip');

    return (
        <MarketingLayout>
            <WipPlaceholder
                title={t('faq.title')}
                description={t('faq.description')}
            />
        </MarketingLayout>
    );
};
