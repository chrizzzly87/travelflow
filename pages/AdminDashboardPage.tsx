import React from 'react';
import { AdminMenu } from '../components/admin/AdminMenu';

const metricTiles = [
    { label: 'Total users', value: 'Coming soon' },
    { label: 'Total trips created', value: 'Coming soon' },
    { label: 'Trips per user', value: 'Coming soon' },
    { label: 'Active users (7d)', value: 'Coming soon' },
    { label: 'Active shared links', value: 'Coming soon' },
    { label: 'Trips with sharing off', value: 'Coming soon' },
    { label: 'Gemini usage', value: 'Coming soon' },
    { label: 'Google Cloud usage', value: 'Coming soon' },
];

export const AdminDashboardPage: React.FC = () => {
    return (
        <div className="min-h-screen bg-slate-50 px-6 py-10 md:px-10">
            <div className="mx-auto w-full max-w-7xl space-y-6">
                <AdminMenu />
                <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-accent-600">Admin planning scaffold</p>
                    <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-900 md:text-4xl">Admin Metrics Dashboard</h1>
                    <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                        Placeholder for the future authenticated admin area. This page will aggregate user, trip, and infrastructure/API usage metrics so operational risks can be monitored in one place.
                    </p>
                </section>

                <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {metricTiles.map((tile) => (
                        <article key={tile.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{tile.label}</p>
                            <p className="mt-3 text-2xl font-black text-slate-900">{tile.value}</p>
                        </article>
                    ))}
                </section>
            </div>
        </div>
    );
};
