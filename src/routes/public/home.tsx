import React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { MarketingHomePage } from '../../../pages/MarketingHomePage';
export const Route = createFileRoute("/_public/{-$locale}")({ component: HomePage });

function HomePage() { return <MarketingHomePage />; }
