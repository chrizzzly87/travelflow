import React, { useEffect, useMemo, useState } from 'react';
import { Navigate, NavLink, useNavigate } from 'react-router-dom';
import { CheckCircle, SpinnerGap } from '@phosphor-icons/react';
import { SiteHeader } from '../components/navigation/SiteHeader';
import { PROFILE_GENDER_OPTIONS } from '../config/profileFields';
import { LOCALE_DROPDOWN_ORDER, LOCALE_LABELS, normalizeLocale } from '../config/locales';
import type { AppLanguage } from '../types';
import { useAuth } from '../hooks/useAuth';
import { getCurrentUserProfile, updateCurrentUserProfile, type ProfileGender } from '../services/profileService';
import { getAnalyticsDebugAttributes, trackEvent } from '../services/analyticsService';

type Mode = 'settings' | 'onboarding';

interface ProfileSettingsPageProps {
    mode?: Mode;
}

interface ProfileFormState {
    firstName: string;
    lastName: string;
    username: string;
    gender: ProfileGender;
    country: string;
    city: string;
    preferredLanguage: AppLanguage;
}

const EMPTY_FORM: ProfileFormState = {
    firstName: '',
    lastName: '',
    username: '',
    gender: '',
    country: '',
    city: '',
    preferredLanguage: 'en',
};

const REQUIRED_FIELDS: Array<keyof Pick<ProfileFormState, 'firstName' | 'lastName' | 'country' | 'city' | 'preferredLanguage'>> = [
    'firstName',
    'lastName',
    'country',
    'city',
    'preferredLanguage',
];

const hasMissingRequiredField = (form: ProfileFormState): boolean =>
    REQUIRED_FIELDS.some((key) => !String(form[key] || '').trim());

export const ProfileSettingsPage: React.FC<ProfileSettingsPageProps> = ({ mode = 'settings' }) => {
    const navigate = useNavigate();
    const { isLoading, isAuthenticated, refreshAccess } = useAuth();
    const [isProfileLoading, setIsProfileLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [form, setForm] = useState<ProfileFormState>(EMPTY_FORM);

    const heading = mode === 'onboarding' ? 'Complete your profile' : 'Profile settings';
    const description = mode === 'onboarding'
        ? 'Before using TravelFlow, we need your core profile details so trip defaults and personalization work reliably.'
        : 'Update your personal details and language preferences. More profile settings can be added here over time.';

    useEffect(() => {
        if (!isAuthenticated) return;
        let active = true;
        setIsProfileLoading(true);
        void getCurrentUserProfile()
            .then((profile) => {
                if (!active || !profile) return;
                setForm({
                    firstName: profile.firstName || '',
                    lastName: profile.lastName || '',
                    username: profile.username || '',
                    gender: profile.gender || '',
                    country: profile.country || '',
                    city: profile.city || '',
                    preferredLanguage: normalizeLocale(profile.preferredLanguage || 'en'),
                });
            })
            .catch((error) => {
                if (!active) return;
                setErrorMessage(error instanceof Error ? error.message : 'Could not load your profile.');
            })
            .finally(() => {
                if (!active) return;
                setIsProfileLoading(false);
            });
        return () => {
            active = false;
        };
    }, [isAuthenticated]);

    const isMissingRequired = useMemo(() => hasMissingRequiredField(form), [form]);

    if (!isLoading && !isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    const updateField = <K extends keyof ProfileFormState>(key: K, value: ProfileFormState[K]) => {
        setForm((current) => ({ ...current, [key]: value }));
    };

    const handleSave = async () => {
        if (isMissingRequired) {
            setErrorMessage('Please fill all required fields.');
            return;
        }
        setIsSaving(true);
        setErrorMessage(null);
        setSaveMessage(null);
        try {
            await updateCurrentUserProfile({
                firstName: form.firstName,
                lastName: form.lastName,
                username: form.username,
                gender: form.gender,
                country: form.country,
                city: form.city,
                preferredLanguage: form.preferredLanguage,
                markOnboardingComplete: mode === 'onboarding',
            });
            await refreshAccess();
            trackEvent(mode === 'onboarding' ? 'profile__onboarding--completed' : 'profile__settings--saved');
            if (mode === 'onboarding') {
                navigate('/create-trip', { replace: true });
                return;
            }
            setSaveMessage('Profile settings saved.');
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'Could not save profile settings.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50">
            <SiteHeader hideCreateTrip={mode === 'onboarding'} />
            <div className="mx-auto w-full max-w-4xl px-5 py-8 md:px-8 md:py-10">
                <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
                    <p className="text-xs font-semibold uppercase tracking-wide text-accent-700">
                        {mode === 'onboarding' ? 'Required onboarding' : 'Account'}
                    </p>
                    <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900">{heading}</h1>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
                    {mode !== 'onboarding' && (
                        <div className="mt-4 flex flex-wrap gap-2 text-xs">
                            <NavLink
                                to="/profile"
                                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-100"
                            >
                                Back to profile
                            </NavLink>
                        </div>
                    )}
                </section>

                {errorMessage && (
                    <section className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                        {errorMessage}
                    </section>
                )}
                {saveMessage && (
                    <section className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                        {saveMessage}
                    </section>
                )}

                <section className="mt-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
                    {isProfileLoading ? (
                        <div className="flex items-center gap-2 text-sm text-slate-500">
                            <SpinnerGap size={16} className="animate-spin" />
                            Loading profile...
                        </div>
                    ) : (
                        <>
                            <div className="grid gap-4 md:grid-cols-2">
                                <label className="space-y-1">
                                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">First name *</span>
                                    <input
                                        value={form.firstName}
                                        onChange={(event) => updateField('firstName', event.target.value)}
                                        className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-accent-400 focus:ring-2 focus:ring-accent-200"
                                    />
                                </label>
                                <label className="space-y-1">
                                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Last name *</span>
                                    <input
                                        value={form.lastName}
                                        onChange={(event) => updateField('lastName', event.target.value)}
                                        className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-accent-400 focus:ring-2 focus:ring-accent-200"
                                    />
                                </label>
                                <label className="space-y-1">
                                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Username</span>
                                    <input
                                        value={form.username}
                                        onChange={(event) => updateField('username', event.target.value)}
                                        className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-accent-400 focus:ring-2 focus:ring-accent-200"
                                        placeholder="Optional public handle"
                                    />
                                </label>
                                <label className="space-y-1">
                                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Gender</span>
                                    <select
                                        value={form.gender}
                                        onChange={(event) => updateField('gender', event.target.value as ProfileGender)}
                                        className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-accent-400 focus:ring-2 focus:ring-accent-200"
                                    >
                                        {PROFILE_GENDER_OPTIONS.map((option) => (
                                            <option key={`gender-${option.value || 'empty'}`} value={option.value}>
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                <label className="space-y-1">
                                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Country *</span>
                                    <input
                                        value={form.country}
                                        onChange={(event) => updateField('country', event.target.value)}
                                        className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-accent-400 focus:ring-2 focus:ring-accent-200"
                                    />
                                </label>
                                <label className="space-y-1">
                                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">City *</span>
                                    <input
                                        value={form.city}
                                        onChange={(event) => updateField('city', event.target.value)}
                                        className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-accent-400 focus:ring-2 focus:ring-accent-200"
                                    />
                                </label>
                                <label className="space-y-1 md:col-span-2">
                                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Preferred language *</span>
                                    <select
                                        value={form.preferredLanguage}
                                        onChange={(event) => updateField('preferredLanguage', event.target.value as AppLanguage)}
                                        className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-accent-400 focus:ring-2 focus:ring-accent-200"
                                    >
                                        {LOCALE_DROPDOWN_ORDER.map((locale) => (
                                            <option key={`profile-locale-${locale}`} value={locale}>
                                                {LOCALE_LABELS[locale]}
                                            </option>
                                        ))}
                                    </select>
                                </label>
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
                                    {mode === 'onboarding' ? 'Save and continue' : 'Save profile settings'}
                                </button>
                                {isMissingRequired && (
                                    <span className="text-xs font-semibold text-amber-700">
                                        Complete all required fields to continue.
                                    </span>
                                )}
                            </div>
                        </>
                    )}
                </section>
            </div>
        </div>
    );
};
