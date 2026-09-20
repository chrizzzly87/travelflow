import React from 'react';
import { Navigate, Link } from 'react-router-dom';
import { ShieldWarning, ArrowLeft } from '@phosphor-icons/react';
import { useAuth } from '../hooks/useAuth';

export const AdminAccessDeniedPage: React.FC = () => {
    const { isLoading, isAdmin } = useAuth();

    if (isLoading) {
        return <div className="min-h-[42vh] w-full bg-secondary" aria-hidden="true" />;
    }

    if (isAdmin) {
        return <Navigate to="/admin/dashboard" replace />;
    }

    return (
        <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
            <section className="rounded-2xl border border-amber-200 bg-card p-6 shadow-sm sm:p-8">
                <div className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-800">
                    <ShieldWarning size={14} />
                    Access denied
                </div>
                <h1 className="mt-4 text-2xl font-black tracking-tight text-foreground">
                    You do not have access to the admin workspace.
                </h1>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    Your account is signed in, but it does not include admin permissions for this area.
                </p>
                <div className="mt-6 flex flex-wrap items-center gap-2">
                    <Link
                        to="/create-trip"
                        className="inline-flex items-center rounded-xl bg-accent-600 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-700"
                    >
                        Go to planner
                    </Link>
                    <Link
                        to="/"
                        className="inline-flex items-center gap-1 rounded-xl border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-secondary"
                    >
                        <ArrowLeft size={14} />
                        Back home
                    </Link>
                </div>
            </section>
        </main>
    );
};
