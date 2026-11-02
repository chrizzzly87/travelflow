import { createFileRoute } from '@tanstack/react-router';
import { ResetPasswordPage } from '../../../pages/ResetPasswordPage';
export const Route = createFileRoute("/_auth/{-$locale}/auth/reset-password")({ component: ResetPasswordPage });
