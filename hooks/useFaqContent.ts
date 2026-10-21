import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
    CONTACT_FAQ_EXCERPT_ITEM_IDS,
    FAQ_SECTION_DEFINITIONS,
    type FaqItemWithSection,
} from '../data/faqContent';

export interface LocalizedFaqSection {
    id: string;
    title: string;
    items: FaqItemWithSection[];
}

// FAQ answers tell people which Contact-form option to pick. Interpolating the
// live `common:contact.form.*` labels keeps the quoted text identical to what
// the form actually renders in that locale, instead of a second translation
// that silently drifts when the form copy changes.
const REASON_KEYS = ['bugReport', 'featureRequest', 'billingAccount', 'dataPrivacy', 'other'] as const;

const SUB_REASON_KEYS: Array<readonly [reason: string, option: string]> = [
    ['bugReport', 'translationWrongMisleading'],
    ['bugReport', 'mapRoutingIssue'],
    ['bugReport', 'performanceIssue'],
    ['billingAccount', 'subscriptionChange'],
    ['billingAccount', 'invoiceReceipt'],
    ['billingAccount', 'paymentFailed'],
    ['billingAccount', 'refundQuestion'],
    ['dataPrivacy', 'dataExport'],
    ['dataPrivacy', 'dataDeletion'],
    ['dataPrivacy', 'securityConcern'],
    ['other', 'responsibleDisclosure'],
];

const capitalize = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1);

export const useFaqContent = () => {
    const { t } = useTranslation(['faq', 'common']);

    const contactLabels = useMemo(() => {
        const labels: Record<string, string> = {};
        REASON_KEYS.forEach((reason) => {
            labels[`reason${capitalize(reason)}`] = t(`common:contact.form.reasonOptions.${reason}`);
        });
        SUB_REASON_KEYS.forEach(([reason, option]) => {
            labels[`sub${capitalize(option)}`] = t(`common:contact.form.subReasonOptions.${reason}.${option}`);
        });
        return labels;
    }, [t]);

    const resolveItem = useMemo(() => (itemId: string, sectionId: string, sectionTitle: string): FaqItemWithSection => ({
        id: itemId,
        sectionId,
        sectionTitle,
        question: t(`faq:items.${itemId}.question`),
        answer: t(`faq:items.${itemId}.answer`, contactLabels),
    }), [t, contactLabels]);

    const sections = useMemo<LocalizedFaqSection[]>(() => (
        FAQ_SECTION_DEFINITIONS.map((section) => {
            const title = t(`faq:sections.${section.id}`);
            return {
                id: section.id,
                title,
                items: section.itemIds.map((itemId) => resolveItem(itemId, section.id, title)),
            };
        })
    ), [t, resolveItem]);

    const itemsById = useMemo(() => {
        const index = new Map<string, FaqItemWithSection>();
        sections.forEach((section) => {
            section.items.forEach((item) => index.set(item.id, item));
        });
        return index;
    }, [sections]);

    const contactExcerptItems = useMemo<FaqItemWithSection[]>(() => (
        CONTACT_FAQ_EXCERPT_ITEM_IDS.flatMap((itemId) => {
            const item = itemsById.get(itemId);
            return item ? [item] : [];
        })
    ), [itemsById]);

    return { sections, itemsById, contactExcerptItems };
};
