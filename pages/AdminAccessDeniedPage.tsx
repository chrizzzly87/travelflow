import React from 'react';
import { Navigate, Link } from '@/app/navigation';
import { ShieldWarning, ArrowLeft } from '@phosphor-icons/react';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui/button';

export const AdminAccessDeniedPage: React.FC = () => {
    const { isLoading, isAdmin } = useAuth();

    if (isLoading) {
        return <div className="min-h-[42vh] w-full bg-background" aria-hidden="true" />;
    }

    if (isAdmin) {
        return <Navigate to="/admin/dashboard" replace />;
    }

    return (
        <main className="flex min-h-[70vh] w-full items-center justify-center bg-background px-4 py-12">
            <section
                aria-labelledby="admin-access-denied-title"
                className="flex w-full max-w-md flex-col items-center gap-4 rounded-lg border border-border bg-card p-6 text-center text-card-foreground sm:p-8"
            >
                <div
                    className="flex size-10 items-center justify-center rounded-lg bg-amber-50 text-amber-700 dark:bg-amber-400/12 dark:text-amber-300"
                    aria-hidden="true"
                >
                    <ShieldWarning size={20} weight="duotone" />
                </div>
                <div className="flex flex-col gap-1.5">
                    <p className="text-sm font-medium text-amber-700 dark:text-amber-300">Access denied</p>
                    <h1 id="admin-access-denied-title" className="text-xl font-semibold tracking-tight text-foreground">
                        You do not have access to the admin workspace
                    </h1>
                    <p className="text-sm leading-6 text-muted-foreground">
                        Your account is signed in, but it does not include admin permissions for this area.
                    </p>
                </div>
                <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row sm:justify-center">
                    <Button asChild variant="outline">
                        <Link to="/">
                            <ArrowLeft aria-hidden="true" className="rtl:rotate-180" />
                            Back home
                        </Link>
                    </Button>
                    <Button asChild>
                        <Link to="/create-trip">Go to planner</Link>
                    </Button>
                </div>
            </section>
        </main>
    );
};
