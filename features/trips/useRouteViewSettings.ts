import { useCallback, useState } from 'react';
import { useLocation } from '../../app/navigation';
import { areViewSettingsEqual } from '../../shared/viewSettings';
import type { IViewSettings } from '../../types';

/** A reconnect may refresh data; only changing the route/version resets an explicit view choice. */
export function useRouteViewSettings(resolvedView?: IViewSettings) {
    const location = useLocation();
    const target = `${location.pathname}:${new URLSearchParams(location.search).get('v') ?? ''}`;
    const [override, setOverride] = useState<{ target: string; view: IViewSettings }>();
    const view = override?.target === target ? override.view : resolvedView;
    const update = useCallback((next: IViewSettings) => {
        if (areViewSettingsEqual(view, next)) return false;
        setOverride({ target, view: next });
        return true;
    }, [target, view]);
    return [view, update] as const;
}
