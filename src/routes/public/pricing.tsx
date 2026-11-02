import { createFileRoute } from '@tanstack/react-router';
import { PricingPage } from '../../../pages/PricingPage';
export const Route = createFileRoute("/_public/{-$locale}/pricing")({ component: PricingPage });
