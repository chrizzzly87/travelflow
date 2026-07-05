import type { Metadata } from 'next';
import React from 'react';
import { buildPageTitle, getServerT } from '../../../../lib/i18n/server';
import { CheckoutScreen } from './CheckoutScreen';

interface PageProps {
    params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { locale } = await params;
    const t = await getServerT(locale, ['pricing']);
    return { title: buildPageTitle(t('checkout.eyebrow', { defaultValue: 'Checkout' })) };
}

export default function CheckoutRoutePage() {
    return <CheckoutScreen />;
}
