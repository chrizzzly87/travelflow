/**
 * Public trip/share metadata only matters to the server-rendered document that
 * crawlers and link unfurlers read. In the browser the transported context
 * covers hydration and the trip leaf's own `head` titles later navigations, so
 * a client navigation or hover preload never waits on a server-function round
 * trip before its trip loader can start.
 */
export const isServerRender = () => typeof window === 'undefined';

export const shouldResolveTripMetadata = (pathname: string) => isServerRender() && /^\/(?:trip|s)\//.test(pathname);
