import { lazy, type ComponentType } from 'react';

import { loadLazyComponentWithRecovery } from '../../services/lazyImportRecovery';

export const lazyWithRecovery = <TModule extends { default: ComponentType<any> },>(
    moduleKey: string,
    importer: () => Promise<TModule>
) => lazy(() => loadLazyComponentWithRecovery(moduleKey, importer));
