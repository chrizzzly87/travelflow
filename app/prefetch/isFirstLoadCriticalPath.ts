import { stripLocalePrefix } from '../../config/routes';

const startsWithSegment = (pathname: string, segment: string): boolean =>
    pathname === segment || pathname.startsWith(`${segment}/`);

export const isFirstLoadCriticalPath = (pathname: string): boolean => {
    const normalizedPathname = stripLocalePrefix(pathname || '/');
    return (
        normalizedPathname === '/'
        || startsWithSegment(normalizedPathname, '/create-trip')
        || startsWithSegment(normalizedPathname, '/trip')
        || startsWithSegment(normalizedPathname, '/example')
    );
};
