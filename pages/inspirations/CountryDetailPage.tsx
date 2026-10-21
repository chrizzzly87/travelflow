import React from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { MarketingLayout } from '../../components/marketing/MarketingLayout';
import { DestinationGuideView } from '../../components/inspirations/DestinationGuideView';
import { DEFAULT_LOCALE } from '../../config/locales';
import { extractLocaleFromPath } from '../../config/routes';
import { resolveDestinationGuide } from '../../services/destinationGuideService';
import { DestinationGuideNotFound } from '../../components/inspirations/DestinationGuideNotFound';

export const CountryDetailPage: React.FC = () => {
  const location = useLocation();
  const locale = extractLocaleFromPath(location.pathname) ?? DEFAULT_LOCALE;
  const { countryName = '' } = useParams<{ countryName: string }>();
  const resolved = resolveDestinationGuide(decodeURIComponent(countryName));

  return (
    <MarketingLayout>
      {resolved
        ? <DestinationGuideView resolved={resolved} locale={locale} />
        : <DestinationGuideNotFound locale={locale} destination={countryName} />}
    </MarketingLayout>
  );
};
