import type { Metadata } from 'next';
import React from 'react';
import { buildPageTitle, getServerT } from '../../../../../lib/i18n/server';
import { AdminAccessDeniedScreen } from './AdminAccessDeniedScreen';

interface PageProps {
    params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { locale } = await params;
    const t = await getServerT(locale, ['common']);
    return { title: buildPageTitle(t('nav.admin')) };
}

export default function AdminAccessDeniedRoutePage() {
    return <AdminAccessDeniedScreen />;
}
