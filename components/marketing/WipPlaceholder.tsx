import React from 'react';

interface WipPlaceholderProps {
    title: string;
    description: string;
}

export const WipPlaceholder: React.FC<WipPlaceholderProps> = ({ title, description }) => {
    return (
        <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
            <span className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-900">
                Work in progress
            </span>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-900">{title}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">{description}</p>
            <p className="mt-6 text-xs text-slate-400">More details and account actions are arriving in upcoming releases.</p>
        </section>
    );
};
