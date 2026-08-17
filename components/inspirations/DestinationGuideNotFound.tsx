import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import type { AppLanguage } from '../../types';
import { buildLocalizedMarketingPath } from '../../config/routes';

export const DestinationGuideNotFound: React.FC<{ locale: AppLanguage; destination: string }> = ({ locale, destination }) => {
  const { t } = useTranslation('pages');
  return (
    <section className="py-20 text-center">
      <h1 className="text-3xl font-black text-slate-900" style={{ fontFamily: 'var(--tf-font-heading)' }}>
        {t('inspirations.subpages.country.notFoundTitle')}
      </h1>
      <p className="mt-4 text-slate-500">
        {t('inspirations.subpages.country.notFoundDescription', { country: decodeURIComponent(destination) })}
      </p>
      <Link to={buildLocalizedMarketingPath('inspirationsCountries', locale)} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-accent-600 px-6 py-3 text-sm font-bold text-white shadow-lg transition-all hover:bg-accent-700">
        <ArrowLeft className="rtl:rotate-180" size={16} weight="bold" />
        {t('inspirations.subpages.guide.backToCountries')}
      </Link>
    </section>
  );
};

