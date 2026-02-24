export interface LegalEntityProfile {
  businessName: string;
  legalForm: string;
  representativeName: string;
  responsibleForContent: string;
  addressLines: string[];
  contactEmail: string;
  privacyEmail: string;
  phone?: string;
  vatId?: string;
  registerCourt?: string;
  registerNumber?: string;
  supervisoryAuthority?: string;
}

export interface LegalHostingProfile {
  provider: string;
  dataRegion: string;
}

export interface LegalSupervisionProfile {
  authorityName: string;
  authorityWebsite: string;
}

export interface LegalReviewDates {
  privacyLastUpdated: string;
  cookiesLastUpdated: string;
}

export interface LegalDisputeProfile {
  odrUrl: string;
  participatesInConsumerArbitration: boolean;
}

export interface LegalProfile {
  entity: LegalEntityProfile;
  hosting: LegalHostingProfile;
  supervision: LegalSupervisionProfile;
  reviewDates: LegalReviewDates;
  dispute: LegalDisputeProfile;
}

/**
 * Source of truth for legal identity/contact data displayed on imprint/privacy pages.
 * Replace placeholder values with real legal data before production launch.
 */
export const LEGAL_PROFILE: LegalProfile = {
  entity: {
    businessName: 'TravelFlow',
    legalForm: 'Sole proprietorship (Kleingewerbe)',
    representativeName: '[Replace with legal representative name]',
    responsibleForContent: '[Replace with responsible person under Sec. 18 para. 2 MStV]',
    addressLines: [
      '[Replace with street and number]',
      '[Replace with postal code and city]',
      '[Replace with country]',
    ],
    contactEmail: '[Replace with legal contact email]',
    privacyEmail: '[Replace with privacy contact email]',
    phone: '',
    vatId: '',
    registerCourt: '',
    registerNumber: '',
    supervisoryAuthority: '',
  },
  hosting: {
    provider: 'Netlify, Inc.',
    dataRegion: 'EU/US edge network',
  },
  supervision: {
    authorityName: '[Replace with competent data protection authority]',
    authorityWebsite: 'https://www.bfdi.bund.de/',
  },
  reviewDates: {
    privacyLastUpdated: '2026-02-24',
    cookiesLastUpdated: '2026-02-24',
  },
  dispute: {
    odrUrl: 'https://ec.europa.eu/consumers/odr',
    participatesInConsumerArbitration: false,
  },
};
