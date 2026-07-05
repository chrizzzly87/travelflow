import type { Metadata } from 'next';
import React from 'react';
import { FaqPage } from '../../../../views/FaqPage';
import { buildPageTitle, getServerT } from '../../../../lib/i18n/server';

interface PageProps {
    params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { locale } = await params;
    const t = await getServerT(locale, ['wip']);
    return { title: buildPageTitle(t('faq.title')) };
}

export default function Page() {
    return <FaqPage />;
}
