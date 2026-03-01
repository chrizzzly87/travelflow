import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, NavLink, useNavigate } from 'react-router-dom';
import { CaretRight, SpinnerGap } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { SiteHeader } from '../components/navigation/SiteHeader';
import { SiteFooter } from '../components/marketing/SiteFooter';
import { Switch } from '../components/ui/switch';
import { ProfileCountryRegionSelect } from '../components/profile/ProfileCountryRegionSelect';
import { PROFILE_GENDER_OPTIONS } from '../config/profileFields';
import { LOCALE_DROPDOWN_ORDER, LOCALE_FLAGS, LOCALE_LABELS, normalizeLocale } from '../config/locales';
import type { AppLanguage } from '../types';
import { useAuth } from '../hooks/useAuth';
import {
    checkUsernameAvailability,
    updateCurrentUserProfile,
    type ProfileGender,
    type UserProfileRecord,
    type UsernameAvailabilityResult,
} from '../services/profileService';
import { getAnalyticsDebugAttributes, trackEvent } from '../services/analyticsService';
import { FlagIcon } from '../components/flags/FlagIcon';
import { Select, SelectContent, SelectItem, SelectTrigger } from '../components/ui/select';
import { buildPath } from '../config/routes';
import { showAppToast } from '../components/ui/appToast';

type Mode = 'settings' | 'onboarding';

interface ProfileSettingsPageProps {
    mode?: Mode;
}

interface ProfileFormState {
    firstName: string;
    lastName: string;
    username: string;
    bio: string;
    gender: ProfileGender;
    country: string;
    city: string;
    preferredLanguage: AppLanguage;
    publicProfileEnabled: boolean;
    defaultPublicTripVisibility: boolean;
}

interface UsernameCheckState {
    loading: boolean;
    result: UsernameAvailabilityResult | null;
    error: string | null;
}

const EMPTY_FORM: ProfileFormState = {
    firstName: '',
    lastName: '',
    username: '',
    bio: '',
    gender: '',
    country: '',
    city: '',
    preferredLanguage: 'en',
    publicProfileEnabled: true,
    defaultPublicTripVisibility: true,
};

const REQUIRED_FIELDS: Array<keyof Pick<ProfileFormState, 'firstName' | 'lastName' | 'country' | 'city' | 'preferredLanguage'>> = [
    'firstName',
    'lastName',
    'country',
    'city',
    'preferredLanguage',
];

type RequiredFieldKey = typeof REQUIRED_FIELDS[number];
type RequiredFieldErrors = Record<RequiredFieldKey, boolean>;

const USERNAME_COOLDOWN_DAYS = 90;
const USERNAME_ALLOWED_PATTERN = /^[A-Za-z0-9_-]{3,40}$/;
const USERNAME_CANONICAL_PATTERN = /^[a-z0-9_-]{3,40}$/;
const normalizeUsernameInput = (value: string): string => value.trim().toLowerCase().replace(/^@+/, '');
const normalizeUsernameDisplayInput = (value: string): string => value.trim().replace(/^@+/, '');
const sanitizeUsernameInput = (value: string): string => (
    value
        .replace(/\s+/g, '')
        .replace(/^@+/, '')
        .replace(/[^A-Za-z0-9_-]/g, '')
);
const usernameHasAlphaNumeric = (value: string): boolean => /[a-z0-9]/.test(value);
const clampBio = (value: string): string => value.slice(0, 160);

const EMPTY_REQUIRED_FIELD_ERRORS: RequiredFieldErrors = {
    firstName: false,
    lastName: false,
    country: false,
    city: false,
    preferredLanguage: false,
};

const PROFILE_GENDER_UNSPECIFIED = 'unspecified';
type ProfileGenderSelectValue = Exclude<ProfileGender, ''> | typeof PROFILE_GENDER_UNSPECIFIED;

const toProfileGenderSelectValue = (value: ProfileGender): ProfileGenderSelectValue => (
    value === '' ? PROFILE_GENDER_UNSPECIFIED : value
);

const fromProfileGenderSelectValue = (value: ProfileGenderSelectValue): ProfileGender => (
    value === PROFILE_GENDER_UNSPECIFIED ? '' : value
);

const computeCooldownEndFromProfile = (profile: UserProfileRecord | null): string | null => {
    if (!profile?.usernameChangedAt) return null;
    const changedAt = Date.parse(profile.usernameChangedAt);
    if (!Number.isFinite(changedAt)) return null;
    return new Date(changedAt + USERNAME_COOLDOWN_DAYS * 24 * 60 * 60 * 1000).toISOString();
};

const formatDateLabel = (value: string, locale: string): string => {
    const parsed = Date.parse(value);
    if (!Number.isFinite(parsed)) return value;
    return new Date(parsed).toLocaleDateString(locale, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
};

export const ProfileSettingsPage: React.FC<ProfileSettingsPageProps> = ({ mode = 'settings' }) => {
    const navigate = useNavigate();
    const { t, i18n } = useTranslation('profile');
    const {
        isLoading,
        isAuthenticated,
        refreshAccess,
        refreshProfile,
        profile: cachedProfile,
        isProfileLoading: isAuthProfileLoading,
    } = useAuth();
    const [isSaving, setIsSaving] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [profile, setProfile] = useState<UserProfileRecord | null>(null);
    const [form, setForm] = useState<ProfileFormState>(EMPTY_FORM);
    const [isUsernameEditing, setIsUsernameEditing] = useState(false);
    const [usernameSuggestions, setUsernameSuggestions] = useState<string[]>([]);
    const [hasHydratedForm, setHasHydratedForm] = useState(false);
    const usernameInputRef = useRef<HTMLInputElement>(null);
    const firstNameInputRef = useRef<HTMLInputElement>(null);
    const lastNameInputRef = useRef<HTMLInputElement>(null);
    const countryFieldRef = useRef<HTMLDivElement>(null);
    const cityInputRef = useRef<HTMLInputElement>(null);
    const preferredLanguageTriggerRef = useRef<HTMLButtonElement>(null);
    const usernameCheckRequestRef = useRef(0);
    const [usernameCheck, setUsernameCheck] = useState<UsernameCheckState>({
        loading: false,
        result: null,
        error: null,
    });
    const [requiredFieldErrors, setRequiredFieldErrors] = useState<RequiredFieldErrors>(EMPTY_REQUIRED_FIELD_ERRORS);

    const appLocale = useMemo(
        () => normalizeLocale(i18n.resolvedLanguage ?? i18n.language ?? 'en'),
        [i18n.language, i18n.resolvedLanguage]
    );

    const heading = mode === 'onboarding' ? t('settings.onboardingTitle') : t('settings.title');
    const description = mode === 'onboarding'
        ? t('settings.onboardingDescription')
        : t('settings.description');

    useEffect(() => {
        if (!isAuthenticated) return;
        if (!cachedProfile && !isAuthProfileLoading) {
            void refreshProfile();
            setHasHydratedForm(true);
            return;
        }
        if (!cachedProfile) return;

        setProfile(cachedProfile);
        setForm({
            firstName: cachedProfile.firstName || '',
            lastName: cachedProfile.lastName || '',
            username: cachedProfile.usernameDisplay || cachedProfile.username || '',
            bio: clampBio(cachedProfile.bio || ''),
            gender: cachedProfile.gender || '',
            country: cachedProfile.country || '',
            city: cachedProfile.city || '',
            preferredLanguage: normalizeLocale(cachedProfile.preferredLanguage || 'en'),
            publicProfileEnabled: cachedProfile.publicProfileEnabled !== false,
            defaultPublicTripVisibility: cachedProfile.defaultPublicTripVisibility !== false,
        });
        setIsUsernameEditing(mode === 'onboarding' || !cachedProfile.username);
        setHasHydratedForm(true);
    }, [cachedProfile, isAuthenticated, isAuthProfileLoading, mode, refreshProfile]);

    const isProfileLoading = isAuthProfileLoading || !hasHydratedForm;

    const normalizedUsername = useMemo(() => normalizeUsernameInput(form.username), [form.username]);
    const normalizedUsernameDisplay = useMemo(() => normalizeUsernameDisplayInput(form.username), [form.username]);

    const currentUsername = (profile?.usernameCanonical || profile?.username || '').trim().toLowerCase();
    const publicProfilePath = normalizedUsername
        ? buildPath('publicProfile', { username: normalizedUsername })
        : null;
    const publicProfileUrlPreview = publicProfilePath
        ? `${typeof window !== 'undefined' ? window.location.origin : ''}${publicProfilePath}`
        : t('settings.publicUrlEmpty');

    const fallbackCooldownEnd = computeCooldownEndFromProfile(profile);
    const cooldownEndsAt = usernameCheck.result?.cooldownEndsAt || fallbackCooldownEnd;
    const cooldownEndsMs = cooldownEndsAt ? Date.parse(cooldownEndsAt) : Number.NaN;
    const isUsernameCooldownActive = Number.isFinite(cooldownEndsMs) && cooldownEndsMs > Date.now();
    const hasUsernameLock = Boolean((profile?.username || '').trim()) && mode !== 'onboarding';
    const isUsernameLocked = hasUsernameLock && !isUsernameEditing;
    const isUsernameEditBlocked = isUsernameCooldownActive;

    const usernameStatus = useMemo(() => {
        if (usernameCheck.loading) return t('settings.usernameStatus.checking');
        if (usernameCheck.error) return usernameCheck.error;

        const availability = usernameCheck.result?.availability;
        if (availability === 'available') return t('settings.usernameStatus.available');
        if (availability === 'taken') return t('settings.usernameStatus.taken');
        if (availability === 'reserved') return t('settings.usernameStatus.reserved');
        if (availability === 'invalid') return t('settings.usernameStatus.invalid');
        if (availability === 'unchanged') return t('settings.usernameStatus.unchanged');
        if (availability === 'cooldown') {
            if (usernameCheck.result?.cooldownEndsAt) {
                return t('settings.usernameStatus.cooldownDate', {
                    date: formatDateLabel(usernameCheck.result.cooldownEndsAt, appLocale),
                });
            }
            return t('settings.usernameStatus.cooldown');
        }

        if (isUsernameLocked) return t('settings.usernameLockedHint');
        return t('settings.usernameStatus.idle');
    }, [appLocale, isUsernameLocked, t, usernameCheck]);

    const usernameStatusTone = useMemo(() => {
        if (usernameCheck.loading) return 'text-slate-500';
        const availability = usernameCheck.result?.availability;
        if (availability === 'available' || availability === 'unchanged') return 'text-emerald-700';
        if (availability === 'cooldown') return 'text-amber-700';
        if (availability === 'taken' || availability === 'invalid' || availability === 'reserved') return 'text-rose-700';
        if (usernameCheck.error) return 'text-rose-700';
        return 'text-slate-500';
    }, [usernameCheck]);

    if (!isLoading && !isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    const updateField = <K extends keyof ProfileFormState>(key: K, value: ProfileFormState[K]) => {
        setForm((current) => ({ ...current, [key]: value }));
        if (REQUIRED_FIELDS.includes(key as RequiredFieldKey)) {
            const nextValue = typeof value === 'string' ? value.trim() : String(value || '').trim();
            if (nextValue) {
                setRequiredFieldErrors((current) => (
                    current[key as RequiredFieldKey]
                        ? { ...current, [key]: false }
                        : current
                ));
            }
        }
    };

    const focusRequiredField = (field: RequiredFieldKey) => {
        if (field === 'firstName') {
            firstNameInputRef.current?.focus();
            return;
        }
        if (field === 'lastName') {
            lastNameInputRef.current?.focus();
            return;
        }
        if (field === 'country') {
            const countryInput = countryFieldRef.current?.querySelector('input[role="combobox"]') as HTMLInputElement | null;
            countryInput?.focus();
            return;
        }
        if (field === 'city') {
            cityInputRef.current?.focus();
            return;
        }
        preferredLanguageTriggerRef.current?.focus();
    };

    const validateRequiredFields = (): { valid: boolean; firstMissing: RequiredFieldKey | null } => {
        const missing = REQUIRED_FIELDS.filter((key) => !String(form[key] || '').trim()) as RequiredFieldKey[];
        if (missing.length === 0) {
            if (Object.values(requiredFieldErrors).some(Boolean)) {
                setRequiredFieldErrors(EMPTY_REQUIRED_FIELD_ERRORS);
            }
            return { valid: true, firstMissing: null };
        }

        setRequiredFieldErrors({
            firstName: missing.includes('firstName'),
            lastName: missing.includes('lastName'),
            country: missing.includes('country'),
            city: missing.includes('city'),
            preferredLanguage: missing.includes('preferredLanguage'),
        });
        return { valid: false, firstMissing: missing[0] || null };
    };

    const buildUsernameSuggestionCandidates = (input: string): string[] => {
        const sanitize = (value: string): string => (
            value
                .trim()
                .toLowerCase()
                .replace(/^@+/, '')
                .replace(/\s+/g, '')
                .replace(/[^a-z0-9_-]/g, '')
        );

        const firstName = sanitize(form.firstName);
        const lastName = sanitize(form.lastName);
        const city = sanitize(form.city);
        const baseInput = sanitize(input);
        const current = sanitize(currentUsername);
        const joined = sanitize(`${firstName}${lastName}`);
        const withUnderscore = sanitize(`${firstName}_${lastName}`);
        const withHyphen = sanitize(`${firstName}-${lastName}`);
        const firstWithInitial = sanitize(`${firstName}${lastName.charAt(0)}`);

        const rawCandidates = [
            baseInput,
            `${baseInput}1`,
            `${baseInput}7`,
            `${baseInput}_trip`,
            `${baseInput}-tf`,
            joined,
            withUnderscore,
            withHyphen,
            firstWithInitial,
            city ? `${firstName || baseInput}_${city}` : '',
            city ? `${joined || baseInput}-${city}` : '',
        ];

        return Array.from(new Set(
            rawCandidates
                .map((candidate) => sanitize(candidate))
                .filter((candidate) => candidate.length >= 3 && candidate.length <= 40 && USERNAME_CANONICAL_PATTERN.test(candidate))
                .filter((candidate) => candidate !== current)
        ));
    };

    const fetchUsernameSuggestions = async (input: string): Promise<string[]> => {
        const candidates = buildUsernameSuggestionCandidates(input).slice(0, 10);
        if (candidates.length === 0) return [];

        const results = await Promise.all(candidates.map(async (candidate) => {
            try {
                const check = await checkUsernameAvailability(candidate);
                if (check.availability === 'available') return check.normalizedUsername;
            } catch {
                return null;
            }
            return null;
        }));

        return Array.from(new Set(results.filter((candidate): candidate is string => Boolean(candidate)))).slice(0, 4);
    };

    const resolveLocalUsernameValidation = (candidateDisplay: string): UsernameAvailabilityResult | null => {
        const candidate = normalizeUsernameInput(candidateDisplay);
        if (!candidate) {
            return {
                normalizedUsername: '',
                availability: 'invalid',
                reason: 'empty',
                cooldownEndsAt: null,
            };
        }
        if (!USERNAME_ALLOWED_PATTERN.test(candidateDisplay) || !USERNAME_CANONICAL_PATTERN.test(candidate) || !usernameHasAlphaNumeric(candidate)) {
            return {
                normalizedUsername: candidate,
                availability: 'invalid',
                reason: 'format',
                cooldownEndsAt: null,
            };
        }
        return null;
    };

    const runUsernameAvailabilityCheck = async (
        candidateDisplay: string,
        options: { logBlockedAttempt?: boolean; includeSuggestions?: boolean } = {}
    ): Promise<{ allowed: boolean; result: UsernameAvailabilityResult | null }> => {
        const normalizedCandidate = normalizeUsernameInput(candidateDisplay);
        const localValidation = resolveLocalUsernameValidation(candidateDisplay);
        if (localValidation) {
            setUsernameCheck({
                loading: false,
                result: localValidation,
                error: null,
            });
            if (options.includeSuggestions) {
                setUsernameSuggestions(await fetchUsernameSuggestions(normalizedCandidate));
            }
            return {
                allowed: false,
                result: localValidation,
            };
        }

        const requestId = usernameCheckRequestRef.current + 1;
        usernameCheckRequestRef.current = requestId;
        setUsernameCheck({
            loading: true,
            result: null,
            error: null,
        });

        try {
            const checkResult = await checkUsernameAvailability(normalizedCandidate, {
                logBlockedAttempt: options.logBlockedAttempt === true,
            });
            if (requestId !== usernameCheckRequestRef.current) {
                return { allowed: false, result: null };
            }

            setUsernameCheck({
                loading: false,
                result: checkResult,
                error: null,
            });
            trackEvent(`profile_settings__username_check--${checkResult.availability}`, {
                username: checkResult.normalizedUsername,
            });

            const isAllowed = checkResult.availability === 'available' || checkResult.availability === 'unchanged';
            if (!isAllowed && options.includeSuggestions) {
                if (checkResult.availability === 'taken' || checkResult.availability === 'reserved' || checkResult.availability === 'invalid') {
                    setUsernameSuggestions(await fetchUsernameSuggestions(normalizedCandidate));
                }
            }

            return {
                allowed: isAllowed,
                result: checkResult,
            };
        } catch (error) {
            if (requestId !== usernameCheckRequestRef.current) {
                return { allowed: false, result: null };
            }
            setUsernameCheck({
                loading: false,
                result: null,
                error: error instanceof Error ? error.message : t('settings.errors.usernameUnavailable'),
            });
            return { allowed: false, result: null };
        }
    };

    const commitUsernameEdit = async (): Promise<boolean> => {
        if (!profile) return false;

        const usernameChanged = normalizedUsername !== currentUsername;
        if (!usernameChanged) {
            setIsUsernameEditing(false);
            setErrorMessage(null);
            setUsernameSuggestions([]);
            setUsernameCheck({
                loading: false,
                result: {
                    normalizedUsername,
                    availability: 'unchanged',
                    reason: null,
                    cooldownEndsAt: null,
                },
                error: null,
            });
            return true;
        }

        const checkAttempt = await runUsernameAvailabilityCheck(normalizedUsernameDisplay, {
            logBlockedAttempt: true,
            includeSuggestions: true,
        });
        if (!checkAttempt.allowed) {
            setErrorMessage(t('settings.errors.usernameUnavailable'));
            return false;
        }

        const updated = await updateCurrentUserProfile({
            firstName: profile.firstName,
            lastName: profile.lastName,
            username: normalizedUsername,
            usernameDisplay: normalizedUsernameDisplay,
            bio: profile.bio,
            gender: profile.gender,
            country: profile.country,
            city: profile.city,
            preferredLanguage: profile.preferredLanguage,
            publicProfileEnabled: profile.publicProfileEnabled,
            defaultPublicTripVisibility: profile.defaultPublicTripVisibility,
            markOnboardingComplete: false,
        });

        setProfile(updated);
        setForm((current) => ({
            ...current,
            username: updated.usernameDisplay || updated.username || current.username,
        }));
        setIsUsernameEditing(mode === 'onboarding' || !updated.username);
        await refreshAccess();
        showAppToast({
            tone: 'success',
            title: t('settings.messages.savedTitle'),
            description: t('settings.messages.saved'),
        });
        return true;
    };

    const handleUnlockUsernameEditing = () => {
        if (!hasUsernameLock) return;
        if (isUsernameCooldownActive) {
            trackEvent('profile_settings__username_edit--blocked_cooldown');
            return;
        }
        trackEvent('profile_settings__username_edit--open');
        setIsUsernameEditing(true);
        window.requestAnimationFrame(() => usernameInputRef.current?.focus());
    };

    const handleSave = async () => {
        const requiredValidation = validateRequiredFields();
        if (!requiredValidation.valid) {
            setErrorMessage(t('settings.errors.required'));
            if (requiredValidation.firstMissing) {
                window.requestAnimationFrame(() => focusRequiredField(requiredValidation.firstMissing as RequiredFieldKey));
            }
            return;
        }

        trackEvent('profile_settings__save--attempt', {
            mode,
            username_changed: normalizedUsername !== currentUsername,
            public_profile_enabled: form.publicProfileEnabled,
            default_public_trip_visibility: form.defaultPublicTripVisibility,
        });

        setIsSaving(true);
        setErrorMessage(null);
        setUsernameSuggestions([]);

        try {
            if (hasUsernameLock && isUsernameEditing) {
                const committed = await commitUsernameEdit();
                if (!committed) return;
                return;
            }

            if (normalizedUsername !== currentUsername) {
                const checkAttempt = await runUsernameAvailabilityCheck(normalizedUsernameDisplay, {
                    logBlockedAttempt: true,
                    includeSuggestions: true,
                });
                if (!checkAttempt.allowed) {
                    setErrorMessage(t('settings.errors.usernameUnavailable'));
                    return;
                }
            }

            const updated = await updateCurrentUserProfile({
                firstName: form.firstName,
                lastName: form.lastName,
                username: normalizedUsername,
                usernameDisplay: normalizedUsernameDisplay,
                bio: form.bio,
                gender: form.gender,
                country: form.country,
                city: form.city,
                preferredLanguage: form.preferredLanguage,
                publicProfileEnabled: form.publicProfileEnabled,
                defaultPublicTripVisibility: form.defaultPublicTripVisibility,
                markOnboardingComplete: mode === 'onboarding',
            });

            setProfile(updated);
            setForm((current) => ({
                ...current,
                username: updated.usernameDisplay || updated.username || current.username,
                bio: clampBio(updated.bio || ''),
                publicProfileEnabled: updated.publicProfileEnabled !== false,
                defaultPublicTripVisibility: updated.defaultPublicTripVisibility !== false,
            }));
            setRequiredFieldErrors(EMPTY_REQUIRED_FIELD_ERRORS);
            setIsUsernameEditing(mode === 'onboarding' || !updated.username);

            await refreshAccess();

            trackEvent(mode === 'onboarding' ? 'profile__onboarding--completed' : 'profile__settings--saved');
            showAppToast({
                tone: 'success',
                title: mode === 'onboarding'
                    ? t('settings.messages.onboardingSavedTitle')
                    : t('settings.messages.savedTitle'),
                description: mode === 'onboarding'
                    ? t('settings.messages.onboardingSaved')
                    : t('settings.messages.saved'),
            });

            if (mode === 'onboarding') {
                navigate('/create-trip', { replace: true });
            }
        } catch (error) {
            setUsernameCheck((current) => ({ ...current, loading: false }));
            setErrorMessage(error instanceof Error ? error.message : t('settings.errors.saveFailed'));
        } finally {
            setIsSaving(false);
        }
    };

    const handleProfileFormSubmit: React.FormEventHandler<HTMLFormElement> = (event) => {
        event.preventDefault();
        void handleSave();
    };

    const handleProfileFormKeyDown: React.KeyboardEventHandler<HTMLFormElement> = (event) => {
        if (event.defaultPrevented) return;
        if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
        const target = event.target as HTMLElement | null;
        if (!target) return;
        const tagName = target.tagName.toLowerCase();
        const role = target.getAttribute('role');
        const isSubmitCandidate = tagName === 'input' || tagName === 'textarea' || role === 'combobox';
        if (!isSubmitCandidate) return;
        event.preventDefault();
        event.currentTarget.requestSubmit();
    };

    return (
        <div className="flex min-h-screen flex-col bg-slate-50">
            <SiteHeader hideCreateTrip />
            <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 px-5 pb-14 pt-8 md:px-8 md:pt-10">
                <section className="space-y-2">
                    <nav className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                        <NavLink to={buildPath('profile')} className="transition-colors hover:text-accent-700">
                            {t('settings.breadcrumb.profile')}
                        </NavLink>
                        <CaretRight size={12} weight="bold" aria-hidden="true" />
                        <span className="text-slate-600">{t('settings.breadcrumb.settings')}</span>
                    </nav>
                    <h1 className="text-3xl font-black tracking-tight text-slate-900 md:text-4xl">{heading}</h1>
                    <p className="max-w-3xl text-sm leading-6 text-slate-600">{description}</p>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
                    {isProfileLoading ? (
                        <div className="space-y-2" aria-hidden="true">
                            <div className="h-10 w-full rounded-lg bg-slate-100" />
                            <div className="h-10 w-full rounded-lg bg-slate-100" />
                            <div className="h-20 w-full rounded-lg bg-slate-100" />
                        </div>
                    ) : (
                        <>
                            {errorMessage && (
                                <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
                                    {errorMessage}
                                </div>
                            )}
                            <form className="space-y-4" onSubmit={handleProfileFormSubmit} onKeyDown={handleProfileFormKeyDown}>
                                <div className="grid gap-4 md:grid-cols-[minmax(0,0.55fr)_minmax(0,1fr)_minmax(0,1fr)]">
                                    <label className="space-y-1">
                                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('settings.fields.gender')}</span>
                                        <Select
                                            value={toProfileGenderSelectValue(form.gender)}
                                            onValueChange={(value) => updateField('gender', fromProfileGenderSelectValue(value as ProfileGenderSelectValue))}
                                        >
                                            <SelectTrigger className="h-10 w-full rounded-lg border-slate-300 text-sm focus:border-accent-400 focus:ring-accent-200">
                                                <span>{
                                                    form.gender
                                                        ? PROFILE_GENDER_OPTIONS.find((option) => option.value === form.gender)?.label || t('settings.fields.unspecified')
                                                        : t('settings.fields.unspecified')
                                                }</span>
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value={PROFILE_GENDER_UNSPECIFIED}>{t('settings.fields.unspecified')}</SelectItem>
                                                {PROFILE_GENDER_OPTIONS.filter((option) => option.value !== '').map((option) => (
                                                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </label>
                                    <label className="space-y-1">
                                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('settings.fields.firstName')}</span>
                                        <input
                                            ref={firstNameInputRef}
                                            value={form.firstName}
                                            onChange={(event) => updateField('firstName', event.target.value)}
                                            aria-invalid={requiredFieldErrors.firstName}
                                            className={`h-10 w-full rounded-lg border px-3 text-sm outline-none focus:ring-2 ${
                                                requiredFieldErrors.firstName
                                                    ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-100'
                                                    : 'border-slate-300 focus:border-accent-400 focus:ring-accent-200'
                                            }`}
                                        />
                                    </label>
                                    <label className="space-y-1">
                                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('settings.fields.lastName')}</span>
                                        <input
                                            ref={lastNameInputRef}
                                            value={form.lastName}
                                            onChange={(event) => updateField('lastName', event.target.value)}
                                            aria-invalid={requiredFieldErrors.lastName}
                                            className={`h-10 w-full rounded-lg border px-3 text-sm outline-none focus:ring-2 ${
                                                requiredFieldErrors.lastName
                                                    ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-100'
                                                    : 'border-slate-300 focus:border-accent-400 focus:ring-accent-200'
                                            }`}
                                        />
                                    </label>
                                </div>

                                <label className="max-w-xl space-y-1">
                                    <span className="flex items-center justify-between gap-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                        <span>{t('settings.fields.username')}</span>
                                        {hasUsernameLock && isUsernameLocked && (
                                            <button
                                                type="button"
                                                aria-label={t('settings.usernameChange')}
                                                onClick={handleUnlockUsernameEditing}
                                                disabled={isSaving}
                                                aria-disabled={isUsernameEditBlocked}
                                                className={`text-[11px] font-semibold normal-case tracking-normal text-accent-700 transition-colors ${
                                                    isUsernameEditBlocked
                                                        ? 'cursor-not-allowed opacity-50'
                                                        : 'hover:text-accent-800'
                                                } disabled:cursor-not-allowed disabled:opacity-50`}
                                                {...getAnalyticsDebugAttributes('profile_settings__username_edit--open')}
                                            >
                                                {t('settings.usernameChange')}
                                            </button>
                                        )}
                                    </span>
                                    <input
                                        ref={usernameInputRef}
                                        aria-label={t('settings.fields.username')}
                                        value={form.username}
                                        onChange={(event) => {
                                            const sanitized = sanitizeUsernameInput(event.target.value);
                                            updateField('username', sanitized);
                                            setUsernameSuggestions([]);
                                            const localValidation = resolveLocalUsernameValidation(sanitized);
                                            setUsernameCheck({
                                                loading: false,
                                                result: localValidation,
                                                error: null,
                                            });
                                        }}
                                        onBlur={() => {
                                            if (isUsernameLocked) return;
                                            if (!normalizedUsernameDisplay) return;
                                            if (normalizedUsername === currentUsername) return;
                                            void runUsernameAvailabilityCheck(normalizedUsernameDisplay, {
                                                logBlockedAttempt: false,
                                                includeSuggestions: true,
                                            });
                                        }}
                                        onKeyDown={(event) => {
                                            if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
                                            if (!(hasUsernameLock && isUsernameEditing)) return;
                                            event.preventDefault();
                                            void handleSave();
                                        }}
                                        pattern="[A-Za-z0-9_-]{3,40}"
                                        autoCapitalize="none"
                                        spellCheck={false}
                                        readOnly={isUsernameLocked}
                                        className={`h-9 w-full rounded-lg border px-3 text-sm outline-none focus:border-accent-400 focus:ring-2 focus:ring-accent-200 ${
                                            isUsernameLocked
                                                ? 'border-slate-200 bg-slate-100 text-slate-600'
                                            : 'border-slate-300 bg-white text-slate-900'
                                        }`}
                                    />
                                    <p className={`text-xs font-medium ${usernameStatusTone}`}>{usernameStatus}</p>
                                    {usernameSuggestions.length > 0 && (
                                        <div className="space-y-1">
                                            <p className="text-xs text-slate-500">{t('settings.usernameSuggestionsTitle')}</p>
                                            <div className="flex flex-wrap gap-1.5">
                                                {usernameSuggestions.map((suggestion) => (
                                                    <button
                                                        key={`username-suggestion-${suggestion}`}
                                                        type="button"
                                                        onClick={() => {
                                                            updateField('username', suggestion);
                                                            setErrorMessage(null);
                                                            setUsernameSuggestions([]);
                                                            setUsernameCheck({
                                                                loading: false,
                                                                result: null,
                                                                error: null,
                                                            });
                                                        }}
                                                        className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
                                                    >
                                                        {suggestion}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </label>

                                <label className="space-y-1">
                                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('settings.fields.bio')}</span>
                                    <textarea
                                        value={form.bio}
                                        onChange={(event) => updateField('bio', clampBio(event.target.value))}
                                        rows={3}
                                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-accent-400 focus:ring-2 focus:ring-accent-200"
                                        maxLength={160}
                                    />
                                    <p className="text-xs text-slate-500">{t('settings.bioHelp')}</p>
                                    <p className="text-xs text-slate-400">{form.bio.length}/160</p>
                                </label>
                                <div className="grid gap-3 md:grid-cols-3">
                                    <div ref={countryFieldRef} className="space-y-1">
                                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('settings.fields.country')}</span>
                                        <ProfileCountryRegionSelect
                                            value={form.country}
                                            locale={appLocale}
                                            disabled={isSaving}
                                            inputClassName={`h-9 rounded-md text-xs ${
                                                requiredFieldErrors.country
                                                    ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-100'
                                                    : ''
                                            }`}
                                            placeholder={t('settings.countryRegionSearchPlaceholder')}
                                            emptyLabel={t('settings.countryRegionEmpty')}
                                            toggleLabel={t('settings.countryRegionToggle')}
                                            onValueChange={(nextCode) => {
                                                updateField('country', nextCode);
                                                trackEvent('profile_settings__country_region--select', { country_code: nextCode });
                                            }}
                                        />
                                    </div>
                                    <label className="space-y-1">
                                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('settings.fields.city')}</span>
                                        <input
                                            ref={cityInputRef}
                                            value={form.city}
                                            onChange={(event) => updateField('city', event.target.value)}
                                            aria-invalid={requiredFieldErrors.city}
                                            className={`h-9 w-full rounded-md border px-2.5 text-xs outline-none focus:ring-2 ${
                                                requiredFieldErrors.city
                                                    ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-100'
                                                    : 'border-slate-300 focus:border-accent-400 focus:ring-accent-200'
                                            }`}
                                        />
                                    </label>
                                    <label htmlFor="profile-language-select" className="space-y-1">
                                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('settings.fields.preferredLanguage')}</span>
                                        <Select
                                            value={form.preferredLanguage}
                                            onValueChange={(value) => updateField('preferredLanguage', value as AppLanguage)}
                                        >
                                            <SelectTrigger
                                                id="profile-language-select"
                                                ref={preferredLanguageTriggerRef}
                                                aria-invalid={requiredFieldErrors.preferredLanguage}
                                                className={`h-9 w-full rounded-md text-xs ${
                                                    requiredFieldErrors.preferredLanguage
                                                        ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-100'
                                                        : 'border-slate-300 focus:border-accent-400 focus:ring-accent-200'
                                                }`}
                                            >
                                                <span className="inline-flex items-center gap-2">
                                                    <FlagIcon code={LOCALE_FLAGS[form.preferredLanguage]} size="sm" className="shrink-0" />
                                                    <span>{LOCALE_LABELS[form.preferredLanguage]}</span>
                                                </span>
                                            </SelectTrigger>
                                            <SelectContent>
                                                {LOCALE_DROPDOWN_ORDER.map((locale) => (
                                                    <SelectItem key={`profile-locale-${locale}`} value={locale} textValue={LOCALE_LABELS[locale]}>
                                                        <span className="inline-flex items-center gap-2">
                                                            <FlagIcon code={LOCALE_FLAGS[locale]} size="sm" className="shrink-0" />
                                                            <span>{LOCALE_LABELS[locale]}</span>
                                                        </span>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </label>
                                </div>

                            <div className="mt-5 grid gap-3 md:grid-cols-2">
                                <article className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-semibold text-slate-900">{t('settings.publicProfileToggleTitle')}</p>
                                            <p className="text-xs text-slate-600">{t('settings.publicProfileToggleDescription')}</p>
                                        </div>
                                        <Switch
                                            checked={form.publicProfileEnabled}
                                            onCheckedChange={(checked) => {
                                                updateField('publicProfileEnabled', Boolean(checked));
                                                trackEvent(`profile_settings__public_profile--${checked ? 'enabled' : 'disabled'}`);
                                            }}
                                            aria-label={t('settings.publicProfileToggleTitle')}
                                        />
                                    </div>
                                </article>

                                <article className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-semibold text-slate-900">{t('settings.defaultVisibilityToggleTitle')}</p>
                                            <p className="text-xs text-slate-600">{t('settings.defaultVisibilityToggleDescription')}</p>
                                        </div>
                                        <Switch
                                            checked={form.defaultPublicTripVisibility}
                                            onCheckedChange={(checked) => {
                                                updateField('defaultPublicTripVisibility', Boolean(checked));
                                                trackEvent(`profile_settings__default_visibility--${checked ? 'enabled' : 'disabled'}`);
                                            }}
                                            aria-label={t('settings.defaultVisibilityToggleTitle')}
                                        />
                                    </div>
                                </article>
                            </div>

                            <div className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('settings.publicUrlLabel')}</p>
                                <p className="mt-1 break-all text-sm font-medium text-slate-700">{publicProfileUrlPreview}</p>
                                {publicProfilePath && (
                                    <NavLink
                                        to={publicProfilePath}
                                        className="mt-2 inline-flex text-sm font-semibold text-accent-700 hover:underline"
                                        onClick={() => trackEvent('profile_settings__public_url--open')}
                                        {...getAnalyticsDebugAttributes('profile_settings__public_url--open')}
                                    >
                                        {t('settings.viewPublicProfile')}
                                    </NavLink>
                                )}
                            </div>

                            <div className="mt-6 flex flex-wrap items-center gap-3">
                                <button
                                    type="submit"
                                    disabled={isSaving}
                                    className="inline-flex h-10 items-center gap-2 rounded-lg bg-accent-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-accent-700 disabled:cursor-not-allowed disabled:opacity-60"
                                    {...getAnalyticsDebugAttributes(mode === 'onboarding' ? 'profile__onboarding--submit' : 'profile__settings--save')}
                                >
                                    {isSaving ? <SpinnerGap size={15} className="animate-spin" /> : null}
                                    {mode === 'onboarding' ? t('settings.actions.saveAndContinue') : t('settings.actions.save')}
                                </button>
                                {Object.values(requiredFieldErrors).some(Boolean) && (
                                    <span className="text-xs font-semibold text-amber-700">
                                        {t('settings.requiredHint')}
                                    </span>
                                )}
                            </div>
                            </form>
                        </>
                    )}
                </section>
            </main>
            <SiteFooter />
        </div>
    );
};
