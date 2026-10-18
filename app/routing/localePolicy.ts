import { notFound } from '@tanstack/react-router';
import { DEFAULT_LOCALE, isLocale } from '../../config/locales';
/** Locale prefixes change language only. Canonical slugs stay English. */
export const validateRouteLocale = (params: { locale?: string }) => {
    if (params.locale && (!isLocale(params.locale) || params.locale === DEFAULT_LOCALE)) throw notFound();
};
