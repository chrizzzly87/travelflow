import { createFileRoute } from '@tanstack/react-router';
import { AdminAiWorkerHealthPage } from '../../../pages/AdminAiWorkerHealthPage';
export const Route = createFileRoute("/_admin/admin/ai-benchmark/worker-health")({ component: AdminAiWorkerHealthPage });
