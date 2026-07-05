import type { Metadata } from 'next';
import React from 'react';
import { buildPageTitle } from '../../../../../lib/i18n/server';
import { ProfileStampsScreen } from './ProfileStampsScreen';

// Matches the App.tsx page-title label: plain English, no translation.
export const metadata: Metadata = { title: buildPageTitle('Profile') };

export default function ProfileStampsRoutePage() {
    return <ProfileStampsScreen />;
}
