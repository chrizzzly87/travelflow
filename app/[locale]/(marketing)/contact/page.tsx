import type { Metadata } from 'next';
import React from 'react';
import { ContactPage } from '../../../../views/ContactPage';
import { buildPageTitle, getServerT } from '../../../../lib/i18n/server';

interface PageProps {
    params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { locale } = await params;
    const t = await getServerT(locale, ['common']);
    return { title: buildPageTitle(t('footer.contact')) };
}

export default function Page() {
    return <ContactPage />;
}
