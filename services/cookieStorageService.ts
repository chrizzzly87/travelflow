export interface BrowserCookieOptions {
  maxAgeSeconds?: number;
  path?: string;
  sameSite?: 'Lax' | 'Strict' | 'None';
  secure?: boolean;
}

const isBrowserRuntime = (): boolean =>
  typeof window !== 'undefined' && typeof document !== 'undefined';

export const readCookieItem = (cookieName: string): string | null => {
  if (!isBrowserRuntime()) return null;
  const cookieParts = document.cookie ? document.cookie.split(';') : [];
  for (const cookiePart of cookieParts) {
    const [rawName, ...rawValueParts] = cookiePart.trim().split('=');
    if (!rawName || rawName !== cookieName) continue;
    const rawValue = rawValueParts.join('=');
    try {
      return decodeURIComponent(rawValue);
    } catch {
      return null;
    }
  }
  return null;
};

export const writeCookieItem = (
  cookieName: string,
  value: string,
  options: BrowserCookieOptions = {},
): void => {
  if (!isBrowserRuntime()) return;

  const sameSite = options.sameSite ?? 'Lax';
  const path = options.path ?? '/';
  const secure = options.secure ?? window.location.protocol === 'https:';
  const maxAgeSegment = typeof options.maxAgeSeconds === 'number'
    ? `; Max-Age=${Math.max(0, Math.round(options.maxAgeSeconds))}`
    : '';
  const secureSegment = secure ? '; Secure' : '';

  document.cookie = `${cookieName}=${encodeURIComponent(value)}; Path=${path}${maxAgeSegment}; SameSite=${sameSite}${secureSegment}`;
};

export const removeCookieItem = (cookieName: string, options: Pick<BrowserCookieOptions, 'path'> = {}): void => {
  if (!isBrowserRuntime()) return;
  const path = options.path ?? '/';
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${cookieName}=; Path=${path}; Max-Age=0; SameSite=Lax${secure}`;
};
