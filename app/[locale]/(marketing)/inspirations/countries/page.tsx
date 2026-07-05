import type { Metadata } from 'next';
import React from 'react';
import { CountriesPage } from '../../../../../views/inspirations/CountriesPage';
import { buildPageTitle, getServerT } from '../../../../../lib/i18n/server';

interface PageProps {
    params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { locale } = await params;
    const t = await getServerT(locale, ['common']);
    return { title: buildPageTitle(t('nav.inspirations')) };
}

export default function Page() {
    return <CountriesPage />;
}
