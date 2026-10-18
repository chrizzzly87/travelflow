import { createFileRoute } from '@tanstack/react-router';
import { LoginPage } from '../../../pages/LoginPage';
export const Route = createFileRoute("/_auth/{-$locale}/login")({ component: LoginPage });
