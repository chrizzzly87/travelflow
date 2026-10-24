import { createFileRoute } from '@tanstack/react-router';
import { CheckoutPage } from '../../../pages/CheckoutPage';
export const Route = createFileRoute("/_client/checkout")({ component: CheckoutPage });
