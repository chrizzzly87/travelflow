import type { Metadata } from 'next';
import React from 'react';
import { buildPageTitle, getServerT } from '../../../../../lib/i18n/server';
import { AdminScreen } from './AdminScreen';

interface PageProps {
    params: Promise<{ locale: string; adminPath?: string[] }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { locale } = await params;
    const t = await getServerT(locale, ['common']);
    return { title: buildPageTitle(t('nav.admin')) };
}

export default function AdminRoutePage() {
    return <AdminScreen />;
}
