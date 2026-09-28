import { BookOpen, ListChecks, MapPinned, Route } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

const CAPABILITIES = [
    { key: 'read', Icon: BookOpen },
    { key: 'stays', Icon: MapPinned },
    { key: 'routes', Icon: Route },
    { key: 'propose', Icon: ListChecks },
] as const;

/**
 * A first-chat introduction: what the agent can look at and that nothing
 * changes without approval. It only appears before a trip has any chats.
 */
export const TripAgentCapabilities: React.FC = () => {
    const { t } = useTranslation('common');

    return (
        <section aria-labelledby="trip-agent-capabilities" className="rounded-xl border border-border bg-card px-3 py-2.5">
            <h3 id="trip-agent-capabilities" className="text-xs font-medium text-foreground">
                {t('tripAgent.capabilitiesTitle')}
            </h3>
            <ul className="mt-2 space-y-1.5">
                {CAPABILITIES.map(({ key, Icon }) => (
                    <li key={key} className="flex items-start gap-2 text-xs text-muted-foreground">
                        <Icon aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                        <span>{t(`tripAgent.capabilities.${key}`)}</span>
                    </li>
                ))}
            </ul>
            <p className="mt-2 text-[11px] text-muted-foreground">{t('tripAgent.changeKindsFooter')}</p>
        </section>
    );
};
