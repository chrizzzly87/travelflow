import { DEFAULT_LOCALE } from '../config/locales';
import { buildLocalizedMarketingPath, isLocalizedMarketingPath, isToolRoute, localizeMarketingPath, stripLocalePrefix } from '../config/routes';
import { AppLanguage } from '../types';

interface BuildLocalizedLocationInput {
    pathname: string;
    search?: string;
    hash?: string;
    targetLocale: AppLanguage;
}

export const buildLocalizedLocation = ({ pathname, search = '', hash = '', targetLocale }: BuildLocalizedLocationInput): string => {
    if (isToolRoute(pathname)) {
        const stripped = stripLocalePrefix(pathname);
        if (stripped === '/create-trip' || stripped === '/create-trip/wizard') {
            const localizedCreateTripPath = targetLocale === DEFAULT_LOCALE ? stripped : `/${targetLocale}${stripped}`;
            return `${localizedCreateTripPath}${search}${hash}`;
        }
        return `${pathname}${search}${hash}`;
    }

    if (!isLocalizedMarketingPath(pathname)) {
        return `${buildLocalizedMarketingPath('home', targetLocale)}${hash}`;
    }

    const localizedPath = localizeMarketingPath(pathname, targetLocale);
    return `${localizedPath}${search}${hash}`;
};
