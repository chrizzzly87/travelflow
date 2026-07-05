import type { Metadata } from 'next';
import React from 'react';
import { ResetPasswordPage } from '../../../../../views/ResetPasswordPage';
import { buildPageTitle, getServerT } from '../../../../../lib/i18n/server';

interface PageProps {
    params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { locale } = await params;
    const t = await getServerT(locale, ['auth']);
    return { title: buildPageTitle(t('reset.title')) };
}

export default function Page() {
    return <ResetPasswordPage />;
}
