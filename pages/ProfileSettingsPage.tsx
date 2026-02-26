import React, { useEffect, useMemo, useState } from 'react';
import { Navigate, NavLink, useNavigate } from 'react-router-dom';
import { CheckCircle } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { SiteHeader } from '../components/navigation/SiteHeader';
import { Switch } from '../components/ui/switch';
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

const USERNAME_CHECK_DEBOUNCE_MS = 350;
const USERNAME_COOLDOWN_DAYS = 90;

const hasMissingRequiredField = (form: ProfileFormState): boolean =>
    REQUIRED_FIELDS.some((key) => !String(form[key] || '').trim());

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
    const [saveMessage, setSaveMessage] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [profile, setProfile] = useState<UserProfileRecord | null>(null);
    const [form, setForm] = useState<ProfileFormState>(EMPTY_FORM);
    const [hasHydratedForm, setHasHydratedForm] = useState(false);
    const [usernameCheck, setUsernameCheck] = useState<UsernameCheckState>({
        loading: false,
        result: null,
        error: null,
    });

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
            username: cachedProfile.username || '',
            bio: cachedProfile.bio || '',
            gender: cachedProfile.gender || '',
            country: cachedProfile.country || '',
            city: cachedProfile.city || '',
            preferredLanguage: normalizeLocale(cachedProfile.preferredLanguage || 'en'),
            publicProfileEnabled: cachedProfile.publicProfileEnabled !== false,
            defaultPublicTripVisibility: cachedProfile.defaultPublicTripVisibility !== false,
        });
        setHasHydratedForm(true);
    }, [cachedProfile, isAuthenticated, isAuthProfileLoading, refreshProfile]);

    const isProfileLoading = isAuthProfileLoading || !hasHydratedForm;

    useEffect(() => {
        if (!isAuthenticated || isProfileLoading) return;
        const normalizedUsername = form.username.trim().toLowerCase();
        if (!normalizedUsername) {
            setUsernameCheck({
                loading: false,
                result: {
                    normalizedUsername: '',
                    availability: 'invalid',
                    reason: 'empty',
                    cooldownEndsAt: null,
                },
                error: null,
            });
            return;
        }

        let active = true;
        const timer = window.setTimeout(() => {
            setUsernameCheck((current) => ({ ...current, loading: true, error: null }));
            void checkUsernameAvailability(normalizedUsername)
                .then((result) => {
                    if (!active) return;
                    setUsernameCheck({
                        loading: false,
                        result,
                        error: null,
                    });
                    trackEvent(`profile_settings__username_check--${result.availability}`, {
                        username: result.normalizedUsername,
                    });
                })
                .catch((error) => {
                    if (!active) return;
                    setUsernameCheck({
                        loading: false,
                        result: null,
                        error: error instanceof Error ? error.message : t('settings.usernameStatus.failed'),
                    });
                });
        }, USERNAME_CHECK_DEBOUNCE_MS);

        return () => {
            active = false;
            window.clearTimeout(timer);
        };
    }, [form.username, isAuthenticated, isProfileLoading, t]);

    const isMissingRequired = useMemo(() => hasMissingRequiredField(form), [form]);
    const normalizedUsername = useMemo(() => form.username.trim().toLowerCase(), [form.username]);
    const isUsernameAvailableToSave = useMemo(() => {
        const availability = usernameCheck.result?.availability;
        return availability === 'available' || availability === 'unchanged';
    }, [usernameCheck.result?.availability]);

    const currentUsername = (profile?.username || '').trim().toLowerCase();
    const publicProfilePath = normalizedUsername
        ? buildPath('publicProfile', { username: normalizedUsername })
        : null;
    const publicProfileUrlPreview = publicProfilePath
        ? `${typeof window !== 'undefined' ? window.location.origin : ''}${publicProfilePath}`
        : t('settings.publicUrlEmpty');

    const fallbackCooldownEnd = computeCooldownEndFromProfile(profile);
    const cooldownEndsAt = usernameCheck.result?.cooldownEndsAt || fallbackCooldownEnd;

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

        return t('settings.usernameStatus.idle');
    }, [appLocale, t, usernameCheck]);

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
    };

    const handleSave = async () => {
        if (isMissingRequired) {
            setErrorMessage(t('settings.errors.required'));
            return;
        }

        if (normalizedUsername !== currentUsername && !isUsernameAvailableToSave) {
            setErrorMessage(t('settings.errors.usernameUnavailable'));
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
        setSaveMessage(null);

        try {
            const updated = await updateCurrentUserProfile({
                firstName: form.firstName,
                lastName: form.lastName,
                username: normalizedUsername,
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
                username: updated.username || current.username,
                bio: updated.bio || '',
                publicProfileEnabled: updated.publicProfileEnabled !== false,
                defaultPublicTripVisibility: updated.defaultPublicTripVisibility !== false,
            }));

            await refreshAccess();

            trackEvent(mode === 'onboarding' ? 'profile__onboarding--completed' : 'profile__settings--saved');
            setSaveMessage(
                mode === 'onboarding'
                    ? t('settings.messages.onboardingSaved')
                    : t('settings.messages.saved')
            );

            if (mode === 'onboarding') {
                navigate('/create-trip', { replace: true });
            }
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : t('settings.errors.saveFailed'));
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50">
            <SiteHeader hideCreateTrip />
            <main className="mx-auto w-full max-w-7xl space-y-6 px-5 pb-14 pt-8 md:px-8 md:pt-10">
                <section className="space-y-1">
                    <h1 className="text-3xl font-black tracking-tight text-slate-900 md:text-4xl">{heading}</h1>
                    <p className="max-w-3xl text-sm leading-6 text-slate-600">{description}</p>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
                    {isProfileLoading ? (
                        <div className="space-y-2" aria-hidden="true">
                            <div className="h-10 w-full animate-pulse rounded-lg bg-slate-100" />
                            <div className="h-10 w-full animate-pulse rounded-lg bg-slate-100" />
                            <div className="h-20 w-full animate-pulse rounded-lg bg-slate-100" />
                        </div>
                    ) : (
                        <>
                            {errorMessage && (
                                <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
                                    {errorMessage}
                                </div>
                            )}
                            {saveMessage && (
                                <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                                    {saveMessage}
                                </div>
                            )}

                            <div className="grid gap-4 md:grid-cols-2">
                                <label className="space-y-1">
                                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('settings.fields.firstName')}</span>
                                    <input
                                        value={form.firstName}
                                        onChange={(event) => updateField('firstName', event.target.value)}
                                        className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-accent-400 focus:ring-2 focus:ring-accent-200"
                                    />
                                </label>
                                <label className="space-y-1">
                                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('settings.fields.lastName')}</span>
                                    <input
                                        value={form.lastName}
                                        onChange={(event) => updateField('lastName', event.target.value)}
                                        className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-accent-400 focus:ring-2 focus:ring-accent-200"
                                    />
                                </label>
                                <label className="space-y-1 md:col-span-2">
                                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('settings.fields.username')}</span>
                                    <input
                                        value={form.username}
                                        onChange={(event) => updateField('username', event.target.value)}
                                        className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-accent-400 focus:ring-2 focus:ring-accent-200"
                                    />
                                    <p className={`text-xs font-medium ${usernameStatusTone}`}>{usernameStatus}</p>
                                    {cooldownEndsAt && (
                                        <p className="text-xs text-amber-700">
                                            {t('settings.usernameCooldownHint', {
                                                date: formatDateLabel(cooldownEndsAt, appLocale),
                                            })}
                                        </p>
                                    )}
                                    <p className="text-xs text-slate-500">{t('settings.usernameHelp')}</p>
                                </label>
                                <label className="space-y-1 md:col-span-2">
                                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('settings.fields.bio')}</span>
                                    <textarea
                                        value={form.bio}
                                        onChange={(event) => updateField('bio', event.target.value)}
                                        rows={3}
                                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-accent-400 focus:ring-2 focus:ring-accent-200"
                                        maxLength={300}
                                    />
                                    <p className="text-xs text-slate-500">{t('settings.bioHelp')}</p>
                                </label>
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
                                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('settings.fields.country')}</span>
                                    <input
                                        value={form.country}
                                        onChange={(event) => updateField('country', event.target.value)}
                                        className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-accent-400 focus:ring-2 focus:ring-accent-200"
                                    />
                                </label>
                                <label className="space-y-1">
                                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('settings.fields.city')}</span>
                                    <input
                                        value={form.city}
                                        onChange={(event) => updateField('city', event.target.value)}
                                        className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-accent-400 focus:ring-2 focus:ring-accent-200"
                                    />
                                </label>
                                <label htmlFor="profile-language-select" className="space-y-1">
                                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('settings.fields.preferredLanguage')}</span>
                                    <Select
                                        value={form.preferredLanguage}
                                        onValueChange={(value) => updateField('preferredLanguage', value as AppLanguage)}
                                    >
                                        <SelectTrigger id="profile-language-select" className="h-10 w-full rounded-lg border-slate-300 text-sm focus:border-accent-400 focus:ring-accent-200">
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
                                    type="button"
                                    onClick={() => void handleSave()}
                                    disabled={isSaving}
                                    className="inline-flex h-10 items-center gap-2 rounded-lg bg-accent-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-accent-700 disabled:cursor-not-allowed disabled:opacity-60"
                                    {...getAnalyticsDebugAttributes(mode === 'onboarding' ? 'profile__onboarding--submit' : 'profile__settings--save')}
                                >
                                    {isSaving ? <SpinnerGap size={15} className="animate-spin" /> : <CheckCircle size={15} />}
                                    {mode === 'onboarding' ? t('settings.actions.saveAndContinue') : t('settings.actions.save')}
                                </button>
                                {isMissingRequired && (
                                    <span className="text-xs font-semibold text-amber-700">
                                        {t('settings.requiredHint')}
                                    </span>
                                )}
                            </div>
                        </>
                    )}
                </section>
            </main>
        </div>
    );
};
