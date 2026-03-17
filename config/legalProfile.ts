export interface LegalEntityProfile {
  businessName: string;
  legalForm: string;
  representativeName: string;
  responsibleForContent: string;
  addressLines: string[];
  contactEmail: string;
  additionalContactEmails?: string[];
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
  termsLastUpdated: string;
  termsVersion: string;
}

export interface LegalDisputeProfile {
  odrUrl?: string;
  odrPlatformDiscontinuedAt?: string;
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
 */
export const LEGAL_PROFILE: LegalProfile = {
  entity: {
    businessName: 'WizzArt',
    legalForm: 'Sole proprietorship (Einzelunternehmen)',
    representativeName: 'Christian Wisniewski',
    responsibleForContent: 'Christian Wisniewski',
    addressLines: ['Pinneberger Str. 17B', '22457 Hamburg', 'Germany'],
    contactEmail: 'contact@wizz.art',
    additionalContactEmails: [],
    privacyEmail: 'legal@wizz.art',
    phone: '',
    vatId: 'DE460717456',
    registerCourt: '',
    registerNumber: '',
    supervisoryAuthority: '',
  },
  hosting: {
    provider: 'Netlify, Inc.',
    dataRegion: 'EU/US edge network',
  },
  supervision: {
    authorityName: 'Der Hamburgische Beauftragte für Datenschutz und Informationsfreiheit (HmbBfDI)',
    authorityWebsite: 'https://datenschutz-hamburg.de/',
  },
  reviewDates: {
    privacyLastUpdated: '2026-02-24',
    cookiesLastUpdated: '2026-02-24',
    termsLastUpdated: '2026-03-03',
    termsVersion: '2026-03-03',
  },
  dispute: {
    odrPlatformDiscontinuedAt: '2025-07-20',
    participatesInConsumerArbitration: false,
  },
};
