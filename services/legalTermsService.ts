import {
  LEGAL_TERMS_BINDING_LOCALE,
  LEGAL_TERMS_FALLBACK_CONTENT_DE,
  LEGAL_TERMS_FALLBACK_CONTENT_EN,
  LEGAL_TERMS_FALLBACK_LAST_UPDATED,
  LEGAL_TERMS_FALLBACK_SUMMARY,
  LEGAL_TERMS_FALLBACK_TITLE,
  LEGAL_TERMS_FALLBACK_VERSION,
} from '../config/legalTermsDefaults';
import { supabase } from './supabaseClient';

export interface LegalTermsVersionRecord {
  version: string;
  title: string;
  summary: string | null;
  bindingLocale: string;
  lastUpdated: string;
  effectiveAt: string;
  requiresReaccept: boolean;
  isCurrent: boolean;
  contentDe: string;
  contentEn: string;
  createdAt: string;
  createdBy: string | null;
}

const normalizeText = (value: unknown): string => (
  typeof value === 'string' ? value.trim() : ''
);

const normalizeOptionalText = (value: unknown): string | null => {
  const normalized = normalizeText(value);
  return normalized.length > 0 ? normalized : null;
};

const parseLegalTermsRow = (row: Record<string, unknown> | null | undefined): LegalTermsVersionRecord | null => {
  if (!row) return null;

  const version = normalizeText(row.version);
  const title = normalizeText(row.title);
  const lastUpdated = normalizeText(row.last_updated);
  const effectiveAt = normalizeText(row.effective_at);
  const createdAt = normalizeText(row.created_at);

  if (!version || !title || !lastUpdated || !effectiveAt || !createdAt) {
    return null;
  }

  return {
    version,
    title,
    summary: normalizeOptionalText(row.summary),
    bindingLocale: normalizeText(row.binding_locale) || LEGAL_TERMS_BINDING_LOCALE,
    lastUpdated,
    effectiveAt,
    requiresReaccept: Boolean(row.requires_reaccept),
    isCurrent: Boolean(row.is_current),
    contentDe: normalizeText(row.content_de),
    contentEn: normalizeText(row.content_en),
    createdAt,
    createdBy: normalizeOptionalText(row.created_by),
  };
};

const fallbackTermsVersion = (): LegalTermsVersionRecord => {
  const now = new Date().toISOString();
  return {
    version: LEGAL_TERMS_FALLBACK_VERSION,
    title: LEGAL_TERMS_FALLBACK_TITLE,
    summary: LEGAL_TERMS_FALLBACK_SUMMARY,
    bindingLocale: LEGAL_TERMS_BINDING_LOCALE,
    lastUpdated: LEGAL_TERMS_FALLBACK_LAST_UPDATED,
    effectiveAt: now,
    requiresReaccept: true,
    isCurrent: true,
    contentDe: LEGAL_TERMS_FALLBACK_CONTENT_DE,
    contentEn: LEGAL_TERMS_FALLBACK_CONTENT_EN,
    createdAt: now,
    createdBy: null,
  };
};

const withFallbackContent = (record: LegalTermsVersionRecord): LegalTermsVersionRecord => ({
  ...record,
  contentDe: record.contentDe || LEGAL_TERMS_FALLBACK_CONTENT_DE,
  contentEn: record.contentEn || LEGAL_TERMS_FALLBACK_CONTENT_EN,
});

export const getCurrentLegalTermsVersion = async (): Promise<LegalTermsVersionRecord> => {
  if (!supabase) return fallbackTermsVersion();

  const { data, error } = await supabase
    .from('legal_terms_versions')
    .select('version,title,summary,binding_locale,last_updated,effective_at,requires_reaccept,is_current,content_de,content_en,created_at,created_by')
    .eq('is_current', true)
    .maybeSingle();

  if (error) return fallbackTermsVersion();

  const parsed = parseLegalTermsRow((data || null) as Record<string, unknown> | null);
  if (!parsed) return fallbackTermsVersion();

  return withFallbackContent(parsed);
};

export const listLegalTermsVersions = async (): Promise<LegalTermsVersionRecord[]> => {
  if (!supabase) return [fallbackTermsVersion()];

  const { data, error } = await supabase
    .from('legal_terms_versions')
    .select('version,title,summary,binding_locale,last_updated,effective_at,requires_reaccept,is_current,content_de,content_en,created_at,created_by')
    .order('effective_at', { ascending: false });

  if (error || !Array.isArray(data)) return [fallbackTermsVersion()];

  const parsed = data
    .map((row) => parseLegalTermsRow(row as Record<string, unknown>))
    .filter((row): row is LegalTermsVersionRecord => Boolean(row))
    .map(withFallbackContent);

  if (parsed.length === 0) return [fallbackTermsVersion()];
  return parsed;
};
