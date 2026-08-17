import React from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { MarketingLayout } from '../../components/marketing/MarketingLayout';
import { DestinationGuideView } from '../../components/inspirations/DestinationGuideView';
import { DestinationGuideNotFound } from '../../components/inspirations/DestinationGuideNotFound';
import { DEFAULT_LOCALE } from '../../config/locales';
import { extractLocaleFromPath } from '../../config/routes';
import { resolveDestinationGuide } from '../../services/destinationGuideService';

export const DestinationDetailPage: React.FC = () => {
  const location = useLocation();
  const locale = extractLocaleFromPath(location.pathname) ?? DEFAULT_LOCALE;
  const { countrySlug = '', destinationSlug = '' } = useParams<{
    countrySlug: string;
    destinationSlug: string;
  }>();
  const resolved = resolveDestinationGuide(decodeURIComponent(countrySlug), decodeURIComponent(destinationSlug));

  return (
    <MarketingLayout>
      {resolved
        ? <DestinationGuideView resolved={resolved} locale={locale} />
        : <DestinationGuideNotFound locale={locale} destination={destinationSlug} />}
    </MarketingLayout>
  );
};

