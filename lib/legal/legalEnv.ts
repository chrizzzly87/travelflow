const LEGAL_ENV_SOURCE: Record<string, string | undefined> = typeof import.meta !== 'undefined' && import.meta.env
    ? (import.meta.env as Record<string, string | undefined>)
    : {};

type LegalEnvKey =
    | 'NEXT_PUBLIC_LEGAL_BUSINESS_NAME'
    | 'NEXT_PUBLIC_LEGAL_LEGAL_FORM'
    | 'NEXT_PUBLIC_LEGAL_NAME'
    | 'NEXT_PUBLIC_LEGAL_ADDRESS'
    | 'NEXT_PUBLIC_LEGAL_EMAIL'
    | 'NEXT_PUBLIC_LEGAL_PHONE'
    | 'NEXT_PUBLIC_LEGAL_RESPONSIBLE'
    | 'NEXT_PUBLIC_LEGAL_VAT_ID'
    | 'NEXT_PUBLIC_LEGAL_REGISTER_COURT'
    | 'NEXT_PUBLIC_LEGAL_REGISTER_NUMBER'
    | 'NEXT_PUBLIC_LEGAL_SUPERVISORY_AUTHORITY'
    | 'NEXT_PUBLIC_LEGAL_PRIVACY_EMAIL'
    | 'NEXT_PUBLIC_LEGAL_DPA_NAME'
    | 'NEXT_PUBLIC_LEGAL_DPA_WEBSITE'
    | 'NEXT_PUBLIC_LEGAL_HOSTING_PROVIDER'
    | 'NEXT_PUBLIC_LEGAL_DATA_STORAGE_REGION'
    | 'NEXT_PUBLIC_LEGAL_PRIVACY_LAST_UPDATED'
    | 'NEXT_PUBLIC_LEGAL_COOKIES_LAST_UPDATED';

const OPTIONAL_KEYS = new Set<LegalEnvKey>([
    'NEXT_PUBLIC_LEGAL_PHONE',
    'NEXT_PUBLIC_LEGAL_VAT_ID',
    'NEXT_PUBLIC_LEGAL_REGISTER_COURT',
    'NEXT_PUBLIC_LEGAL_REGISTER_NUMBER',
    'NEXT_PUBLIC_LEGAL_SUPERVISORY_AUTHORITY',
]);

const WARNED_KEYS = new Set<LegalEnvKey>();

const FALLBACKS: Record<LegalEnvKey, string> = {
    NEXT_PUBLIC_LEGAL_BUSINESS_NAME: '[Business name – set NEXT_PUBLIC_LEGAL_BUSINESS_NAME]',
    NEXT_PUBLIC_LEGAL_LEGAL_FORM: '[Legal form – set NEXT_PUBLIC_LEGAL_LEGAL_FORM]',
    NEXT_PUBLIC_LEGAL_NAME: '[Legal representative – set NEXT_PUBLIC_LEGAL_NAME]',
    NEXT_PUBLIC_LEGAL_ADDRESS: '[Address – set NEXT_PUBLIC_LEGAL_ADDRESS]',
    NEXT_PUBLIC_LEGAL_EMAIL: '[Contact email – set NEXT_PUBLIC_LEGAL_EMAIL]',
    NEXT_PUBLIC_LEGAL_PHONE: 'Not provided (phone optional)',
    NEXT_PUBLIC_LEGAL_RESPONSIBLE: '[Responsible person (§18 MStV) – set NEXT_PUBLIC_LEGAL_RESPONSIBLE]',
    NEXT_PUBLIC_LEGAL_VAT_ID: 'Not applicable for small business (Kleingewerbe)',
    NEXT_PUBLIC_LEGAL_REGISTER_COURT: 'Not registered in the commercial register',
    NEXT_PUBLIC_LEGAL_REGISTER_NUMBER: '—',
    NEXT_PUBLIC_LEGAL_SUPERVISORY_AUTHORITY: 'Not specified',
    NEXT_PUBLIC_LEGAL_PRIVACY_EMAIL: '[Privacy contact – set NEXT_PUBLIC_LEGAL_PRIVACY_EMAIL]',
    NEXT_PUBLIC_LEGAL_DPA_NAME: '[Supervisory authority name – set NEXT_PUBLIC_LEGAL_DPA_NAME]',
    NEXT_PUBLIC_LEGAL_DPA_WEBSITE: '[https://authority.example] (set NEXT_PUBLIC_LEGAL_DPA_WEBSITE)',
    NEXT_PUBLIC_LEGAL_HOSTING_PROVIDER: 'Netlify, Inc. (United States) – EU edge network',
    NEXT_PUBLIC_LEGAL_DATA_STORAGE_REGION: 'European Union',
    NEXT_PUBLIC_LEGAL_PRIVACY_LAST_UPDATED: '[yyyy-mm-dd – set NEXT_PUBLIC_LEGAL_PRIVACY_LAST_UPDATED]',
    NEXT_PUBLIC_LEGAL_COOKIES_LAST_UPDATED: '[yyyy-mm-dd – set NEXT_PUBLIC_LEGAL_COOKIES_LAST_UPDATED]',
};

const readEnvValue = (key: LegalEnvKey): string => {
    const raw = LEGAL_ENV_SOURCE[key];
    if (typeof raw === 'string' && raw.trim().length > 0) {
        return raw.trim();
    }

    if (!OPTIONAL_KEYS.has(key) && !WARNED_KEYS.has(key) && typeof console !== 'undefined') {
        console.warn(`[legal] Missing environment variable ${key}. Using fallback placeholder.`);
        WARNED_KEYS.add(key);
    }

    return FALLBACKS[key];
};

export interface LegalContactInfo {
    businessName: string;
    legalForm: string;
    representative: string;
    address: string;
    email: string;
    phone: string;
    responsible: string;
    vatId: string;
    registerCourt: string;
    registerNumber: string;
    supervisoryAuthority: string;
    privacyEmail: string;
}

export interface LegalSupervisionInfo {
    authorityName: string;
    authorityWebsite: string;
}

export interface HostingInfo {
    provider: string;
    dataRegion: string;
}

export interface LegalReviewDates {
    privacyLastUpdated: string;
    cookiesLastUpdated: string;
}

export const getLegalContactInfo = (): LegalContactInfo => {
    const contactEmail = readEnvValue('NEXT_PUBLIC_LEGAL_EMAIL');
    const privacyEmail = LEGAL_ENV_SOURCE.NEXT_PUBLIC_LEGAL_PRIVACY_EMAIL?.trim().length
        ? readEnvValue('NEXT_PUBLIC_LEGAL_PRIVACY_EMAIL')
        : contactEmail;

    return {
        businessName: readEnvValue('NEXT_PUBLIC_LEGAL_BUSINESS_NAME'),
        legalForm: readEnvValue('NEXT_PUBLIC_LEGAL_LEGAL_FORM'),
        representative: readEnvValue('NEXT_PUBLIC_LEGAL_NAME'),
        address: readEnvValue('NEXT_PUBLIC_LEGAL_ADDRESS'),
        email: contactEmail,
        phone: readEnvValue('NEXT_PUBLIC_LEGAL_PHONE'),
        responsible: readEnvValue('NEXT_PUBLIC_LEGAL_RESPONSIBLE'),
        vatId: readEnvValue('NEXT_PUBLIC_LEGAL_VAT_ID'),
        registerCourt: readEnvValue('NEXT_PUBLIC_LEGAL_REGISTER_COURT'),
        registerNumber: readEnvValue('NEXT_PUBLIC_LEGAL_REGISTER_NUMBER'),
        supervisoryAuthority: readEnvValue('NEXT_PUBLIC_LEGAL_SUPERVISORY_AUTHORITY'),
        privacyEmail,
    };
};

export const getLegalSupervisionInfo = (): LegalSupervisionInfo => ({
    authorityName: readEnvValue('NEXT_PUBLIC_LEGAL_DPA_NAME'),
    authorityWebsite: readEnvValue('NEXT_PUBLIC_LEGAL_DPA_WEBSITE'),
});

export const getHostingInfo = (): HostingInfo => ({
    provider: readEnvValue('NEXT_PUBLIC_LEGAL_HOSTING_PROVIDER'),
    dataRegion: readEnvValue('NEXT_PUBLIC_LEGAL_DATA_STORAGE_REGION'),
});

export const getLegalReviewDates = (): LegalReviewDates => ({
    privacyLastUpdated: readEnvValue('NEXT_PUBLIC_LEGAL_PRIVACY_LAST_UPDATED'),
    cookiesLastUpdated: readEnvValue('NEXT_PUBLIC_LEGAL_COOKIES_LAST_UPDATED'),
});

export const formatMultilineAddress = (value: string): string[] =>
    value.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.length > 0);
