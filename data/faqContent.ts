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

export const FAQ_SECTIONS: FaqSection[] = [
  {
    id: 'general',
    title: 'General',
    items: [
      {
        id: 'general-what-include-bug-report',
        question: 'What should I include when reporting a website or app problem?',
        answer: 'Include what you expected, what happened instead, and the page you were on. If possible, add the exact text, button name, or feature you used so we can reproduce it quickly.',
      },
      {
        id: 'general-report-translation-issue',
        question: 'How do I report translation issues?',
        answer: 'Use the Contact page and choose “Problem with the website/app”, then select “Translations are wrong or misleading”. This routes your report to the right queue immediately.',
      },
      {
        id: 'general-support-response-time',
        question: 'How fast does support respond?',
        answer: 'We usually reply within 2-3 business days. Complex issues can take longer if we need to investigate technical logs or coordinate with partners.',
      },
      {
        id: 'general-need-account-for-contact',
        question: 'Do I need an account to contact support?',
        answer: 'No. You can contact us without an account. If you are signed in, we include your account context automatically to speed up troubleshooting.',
      },
    ],
  },
  {
    id: 'billing',
    title: 'Billing',
    items: [
      {
        id: 'billing-change-plan',
        question: 'How do I change my subscription plan?',
        answer: 'Send a message through Contact and choose “Billing / account” with “Change or cancel subscription”. We will guide you through the available options.',
      },
      {
        id: 'billing-update-payment-method',
        question: 'How do I update my payment method?',
        answer: 'Use “Billing / account” and select “Payment failed” or “Invoice or receipt question”, depending on your case. Include the last 4 digits and date if available.',
      },
      {
        id: 'billing-cancel-subscription',
        question: 'How do I cancel my subscription?',
        answer: 'Open Contact, choose “Billing / account”, and pick “Change or cancel subscription”. We will confirm timing and any remaining access period.',
      },
      {
        id: 'billing-refund-policy',
        question: 'How do refund requests work?',
        answer: 'Choose “Billing / account” and “Refund question” in Contact. Add your transaction date and the account email used during checkout.',
      },
    ],
  },
  {
    id: 'privacy',
    title: 'Privacy & Data',
    items: [
      {
        id: 'privacy-request-export-delete',
        question: 'How can I request data export or deletion?',
        answer: 'Use “Data/privacy request” on the Contact form and pick either “Request my data export” or “Request data deletion”. We may ask you to verify account ownership.',
      },
      {
        id: 'privacy-cookie-consent',
        question: 'Where can I manage cookie and consent settings?',
        answer: 'You can update consent in the cookie controls and review details on the Cookie Policy page.',
      },
      {
        id: 'privacy-contact-data-usage',
        question: 'How do you use contact form data?',
        answer: 'We use contact form data only to process and reply to your request. We do not use it for unrelated marketing outreach.',
      },
      {
        id: 'privacy-security-concern',
        question: 'How should I report a security concern?',
        answer: 'Use the Contact form and select “Data/privacy request” with “Security concern”, or choose “Other” with “Security disclosure”. Include reproduction details if safe to share.',
      },
    ],
  },
  {
    id: 'product',
    title: 'Product & Planning',
    items: [
      {
        id: 'product-map-route-different',
        question: 'Why can map routes look different than expected?',
        answer: 'Routes depend on provider availability, map data quality, and temporary transport constraints. If a route looks wrong, report it under “Problem with the website/app” and pick “Map or route issue”.',
      },
      {
        id: 'product-feature-suggestions',
        question: 'Where should I suggest product improvements?',
        answer: 'Use the Contact form with “Feature request” and pick the topic that best fits your idea. This helps us prioritize roadmap work faster.',
      },
      {
        id: 'product-slow-performance',
        question: 'What should I do if the app feels slow or unstable?',
        answer: 'Report the issue as “Problem with the website/app” and choose “Slow or unstable performance”. Mention browser, device type, and the page where you noticed the slowdown.',
      },
      {
        id: 'product-share-trip',
        question: 'How can I share a trip with someone else?',
        answer: 'Open your trip and use the share actions to generate a link. If sharing fails, report it as a website/app problem and include the trip page path.',
      },
    ],
  },
];

export const FAQ_ITEMS: FaqItemWithSection[] = FAQ_SECTIONS.flatMap((section) =>
  section.items.map((item) => ({
    ...item,
    sectionId: section.id,
    sectionTitle: section.title,
  }))
);

const FAQ_ITEM_INDEX = new Map<string, FaqItemWithSection>(
  FAQ_ITEMS.map((item) => [item.id, item])
);

export const getFaqItemById = (id: string): FaqItemWithSection | null =>
  FAQ_ITEM_INDEX.get(id) ?? null;

const CONTACT_FAQ_EXCERPT_ITEM_IDS = [
  'general-what-include-bug-report',
  'general-report-translation-issue',
  'general-support-response-time',
  'billing-refund-policy',
] as const;

export const CONTACT_FAQ_EXCERPT_ITEMS: FaqItemWithSection[] = CONTACT_FAQ_EXCERPT_ITEM_IDS
  .map((itemId) => getFaqItemById(itemId))
  .filter((item): item is FaqItemWithSection => Boolean(item));
