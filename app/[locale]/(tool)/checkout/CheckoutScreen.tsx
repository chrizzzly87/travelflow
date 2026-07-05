'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { MarketingRouteLoadingShell } from '../../../../components/bootstrap/MarketingRouteLoadingShell';

const CheckoutPage = dynamic(
    () => import('../../../../views/CheckoutPage').then((m) => m.CheckoutPage),
    { ssr: false, loading: () => <MarketingRouteLoadingShell /> }
);

export const CheckoutScreen: React.FC = () => <CheckoutPage />;
