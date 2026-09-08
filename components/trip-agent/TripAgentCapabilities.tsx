import { BookOpen, ChevronDown, ListChecks, MapPinned, Route } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';

const CAPABILITIES = [
    { key: 'read', Icon: BookOpen },
    { key: 'stays', Icon: MapPinned },
    { key: 'routes', Icon: Route },
    { key: 'propose', Icon: ListChecks },
] as const;

const CHANGE_KINDS = ['addItem', 'moveItem', 'removeItem', 'updateItem', 'stays', 'segment', 'trip'] as const;

/**
 * Plain-language list of what the agent may call and which trip changes it can
 * propose, so the tool chips in a run are recognizable rather than opaque.
 */
export const TripAgentCapabilities: React.FC = () => {
    const { t } = useTranslation('common');
    const [isOpen, setIsOpen] = useState(false);

    return (
        <Collapsible open={isOpen} onOpenChange={setIsOpen} className="rounded-xl border border-slate-200 bg-white">
            <CollapsibleTrigger className="flex w-full items-center gap-2 px-3 py-2 text-start text-xs font-medium text-slate-600 transition-colors hover:text-slate-900">
                <span className="min-w-0 flex-1">{t('tripAgent.capabilitiesTitle')}</span>
                <ChevronDown className={`size-3.5 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </CollapsibleTrigger>
            <CollapsibleContent>
                <div className="space-y-3 border-t border-slate-100 px-3 py-2.5">
                    <ul className="space-y-1.5">
                        {CAPABILITIES.map(({ key, Icon }) => (
                            <li key={key} className="flex items-start gap-2 text-xs text-slate-600">
                                <Icon className="mt-0.5 size-3.5 shrink-0 text-slate-400" />
                                <span>{t(`tripAgent.capabilities.${key}`)}</span>
                            </li>
                        ))}
                    </ul>
                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                            {t('tripAgent.changeKindsTitle')}
                        </p>
                        <ul className="mt-1 flex flex-wrap gap-1">
                            {CHANGE_KINDS.map((kind) => (
                                <li
                                    key={kind}
                                    className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[11px] text-slate-600"
                                >
                                    {t(`tripAgent.changeKinds.${kind}`)}
                                </li>
                            ))}
                        </ul>
                        <p className="mt-1.5 text-[11px] text-slate-500">{t('tripAgent.changeKindsFooter')}</p>
                    </div>
                </div>
            </CollapsibleContent>
        </Collapsible>
    );
};
