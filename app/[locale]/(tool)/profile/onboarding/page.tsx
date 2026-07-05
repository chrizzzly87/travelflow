import type { Metadata } from 'next';
import React from 'react';
import { buildPageTitle } from '../../../../../lib/i18n/server';
import { ProfileOnboardingScreen } from './ProfileOnboardingScreen';

// Matches the App.tsx page-title label: plain English, no translation.
export const metadata: Metadata = { title: buildPageTitle('Complete profile') };

export default function ProfileOnboardingRoutePage() {
    return <ProfileOnboardingScreen />;
}
