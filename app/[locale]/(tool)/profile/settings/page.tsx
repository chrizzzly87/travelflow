import type { Metadata } from 'next';
import React from 'react';
import { buildPageTitle } from '../../../../../lib/i18n/server';
import { ProfileSettingsScreen } from './ProfileSettingsScreen';

// Matches the App.tsx page-title label: plain English, no translation.
export const metadata: Metadata = { title: buildPageTitle('Profile settings') };

export default function ProfileSettingsRoutePage() {
    return <ProfileSettingsScreen />;
}
