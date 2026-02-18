import React, { useEffect, useState } from 'react';
import { Navigate, NavLink } from 'react-router-dom';
import { IdentificationCard, GearSix, ShieldCheck, SpinnerGap } from '@phosphor-icons/react';
import { SiteHeader } from '../components/navigation/SiteHeader';
import { useAuth } from '../hooks/useAuth';
import { getCurrentUserProfile, type UserProfileRecord } from '../services/profileService';

const initialsFrom = (profile: UserProfileRecord | null, fallbackEmail: string | null): string => {
    const first = profile?.firstName?.trim() || '';
    const last = profile?.lastName?.trim() || '';
    if (first || last) {
        return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase() || 'U';
    }
    return (fallbackEmail || 'user').charAt(0).toUpperCase();
};

export const ProfilePage: React.FC = () => {
    const { isLoading, isAuthenticated, access, isAdmin } = useAuth();
    const [profile, setProfile] = useState<UserProfileRecord | null>(null);
    const [loadingProfile, setLoadingProfile] = useState(true);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    useEffect(() => {
        if (!isAuthenticated) return;
        let active = true;
        setLoadingProfile(true);
        void getCurrentUserProfile()
            .then((nextProfile) => {
                if (!active) return;
                setProfile(nextProfile);
            })
            .catch((error) => {
                if (!active) return;
                setErrorMessage(error instanceof Error ? error.message : 'Could not load profile.');
            })
            .finally(() => {
                if (!active) return;
                setLoadingProfile(false);
            });
        return () => {
            active = false;
        };
    }, [isAuthenticated]);

    if (!isLoading && !isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    const displayName = profile?.displayName
        || [profile?.firstName || '', profile?.lastName || ''].filter(Boolean).join(' ')
        || access?.email
        || 'Traveler';

    return (
        <div className="min-h-screen bg-slate-50">
            <SiteHeader hideCreateTrip />
            <div className="mx-auto w-full max-w-4xl space-y-4 px-5 py-8 md:px-8 md:py-10">
                <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
                    <p className="text-xs font-semibold uppercase tracking-wide text-accent-700">Account profile</p>
                    <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900">Your profile</h1>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                        Keep your personal details current so trip defaults and personalized suggestions stay accurate.
                    </p>
                </section>

                {errorMessage && (
                    <section className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                        {errorMessage}
                    </section>
                )}

                <section className="grid gap-4 md:grid-cols-[minmax(0,1fr)_320px]">
                    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        {loadingProfile ? (
                            <div className="flex items-center gap-2 text-sm text-slate-500">
                                <SpinnerGap size={16} className="animate-spin" />
                                Loading profile...
                            </div>
                        ) : (
                            <div className="flex items-start gap-4">
                                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-100 text-lg font-black text-accent-800">
                                    {initialsFrom(profile, access?.email || null)}
                                </div>
                                <div className="min-w-0">
                                    <h2 className="truncate text-xl font-black tracking-tight text-slate-900">{displayName}</h2>
                                    <p className="mt-1 truncate text-sm text-slate-600">{access?.email || 'No email available'}</p>
                                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 font-semibold text-slate-700">
                                            Tier: {access?.tierKey || 'tier_free'}
                                        </span>
                                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 font-semibold text-slate-700">
                                            Role: {access?.role || 'user'}
                                        </span>
                                        {profile?.preferredLanguage && (
                                            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 font-semibold text-slate-700">
                                                Language: {profile.preferredLanguage.toUpperCase()}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </article>

                    <aside className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <NavLink
                            to="/profile/settings"
                            className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
                        >
                            <span className="inline-flex items-center gap-2">
                                <GearSix size={16} />
                                Personal settings
                            </span>
                            <span aria-hidden="true">&rarr;</span>
                        </NavLink>
                        <NavLink
                            to="/create-trip"
                            className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
                        >
                            <span className="inline-flex items-center gap-2">
                                <IdentificationCard size={16} />
                                Go to planner
                            </span>
                            <span aria-hidden="true">&rarr;</span>
                        </NavLink>
                        {isAdmin && (
                            <NavLink
                                to="/admin/dashboard"
                                className="flex items-center justify-between rounded-xl border border-accent-200 bg-accent-50 px-3 py-2.5 text-sm font-semibold text-accent-900 transition-colors hover:bg-accent-100"
                            >
                                <span className="inline-flex items-center gap-2">
                                    <ShieldCheck size={16} />
                                    Open admin workspace
                                </span>
                                <span aria-hidden="true">&rarr;</span>
                            </NavLink>
                        )}
                    </aside>
                </section>
            </div>
        </div>
    );
};
