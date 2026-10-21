// Structure only. Every user-facing string lives in the `faq` locale namespace
// (`locales/*/faq.json`) and is resolved through `useFaqContent`, so section
// titles, questions and answers follow the active locale.
export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export interface FaqSection {
  id: string;
  title: string;
  items: FaqItem[];
}

export interface FaqItemWithSection extends FaqItem {
  sectionId: string;
  sectionTitle: string;
}

export interface FaqSectionDefinition {
  id: string;
  itemIds: string[];
}

export const FAQ_SECTION_DEFINITIONS: FaqSectionDefinition[] = [
  {
    id: 'general',
    itemIds: [
      'general-what-include-bug-report',
      'general-report-translation-issue',
      'general-support-response-time',
      'general-need-account-for-contact',
    ],
  },
  {
    id: 'billing',
    itemIds: [
      'billing-change-plan',
      'billing-update-payment-method',
      'billing-cancel-subscription',
      'billing-refund-policy',
    ],
  },
  {
    id: 'privacy',
    itemIds: [
      'privacy-request-export-delete',
      'privacy-cookie-consent',
      'privacy-contact-data-usage',
      'privacy-security-concern',
    ],
  },
  {
    id: 'product',
    itemIds: [
      'product-map-route-different',
      'product-feature-suggestions',
      'product-slow-performance',
      'product-share-trip',
    ],
  },
];

export const FAQ_ITEM_IDS: string[] = FAQ_SECTION_DEFINITIONS.flatMap((section) => section.itemIds);

const FAQ_SECTION_ID_BY_ITEM_ID = new Map<string, string>(
  FAQ_SECTION_DEFINITIONS.flatMap((section) => section.itemIds.map((itemId) => [itemId, section.id] as const))
);

/** The section an anchor belongs to, or null when the hash is not a known FAQ item. */
export const getFaqSectionIdForItem = (itemId: string): string | null =>
  FAQ_SECTION_ID_BY_ITEM_ID.get(itemId) ?? null;

export const CONTACT_FAQ_EXCERPT_ITEM_IDS: string[] = [
  'general-what-include-bug-report',
  'general-report-translation-issue',
  'general-support-response-time',
  'billing-refund-policy',
];
