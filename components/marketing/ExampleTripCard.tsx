import React from 'react';
import { Clock, MapPin } from '@phosphor-icons/react';
import type { ExampleTripCard as ExampleTripCardType } from '../../data/exampleTripCards';

interface ExampleTripCardProps {
    card: ExampleTripCardType;
}

export const ExampleTripCard: React.FC<ExampleTripCardProps> = ({ card }) => {
    return (
        <article className="rounded-2xl border border-slate-200 bg-white shadow-sm transition-all hover:shadow-lg cursor-pointer">
            {/* Map placeholder */}
            <div className={`relative h-36 rounded-t-2xl ${card.mapColor} overflow-hidden`}>
                {/* Decorative route dots */}
                <div className={`absolute left-[20%] top-[30%] h-2.5 w-2.5 rounded-full ${card.mapAccent}`} />
                <div className={`absolute left-[40%] top-[55%] h-2 w-2 rounded-full ${card.mapAccent} opacity-70`} />
                <div className={`absolute left-[60%] top-[35%] h-3 w-3 rounded-full ${card.mapAccent}`} />
                <div className={`absolute left-[75%] top-[60%] h-2 w-2 rounded-full ${card.mapAccent} opacity-60`} />
                {/* Decorative route line */}
                <svg className="absolute inset-0 h-full w-full" viewBox="0 0 340 144" fill="none" preserveAspectRatio="none">
                    <path
                        d="M68 43 L136 79 L204 50 L255 86"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeDasharray="4 4"
                        className="text-slate-400/40"
                    />
                </svg>
            </div>

            {/* Body */}
            <div className="p-4">
                <h3 className="text-base font-bold text-slate-900">{card.title}</h3>

                {/* Country flags + names */}
                <div className="mt-1.5 flex items-center gap-1.5 text-sm text-slate-600">
                    {card.countries.map((c) => (
                        <span key={c.name} className="inline-flex items-center gap-1">
                            <span>{c.flag}</span>
                            <span>{c.name}</span>
                        </span>
                    ))}
                </div>

                {/* Stats row */}
                <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1">
                        <Clock size={14} weight="duotone" className="text-accent-500" />
                        {card.durationDays} days
                    </span>
                    <span className="inline-flex items-center gap-1">
                        <MapPin size={14} weight="duotone" className="text-accent-500" />
                        {card.cityCount} cities
                    </span>
                </div>

                {/* Tags */}
                <div className="mt-3 flex flex-wrap gap-1.5">
                    {card.tags.map((tag) => (
                        <span
                            key={tag}
                            className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600"
                        >
                            {tag}
                        </span>
                    ))}
                </div>
            </div>

            {/* Footer */}
            <div className="border-t border-slate-100 px-4 py-3 flex items-center gap-2">
                <div className={`h-6 w-6 rounded-full ${card.avatarColor} flex items-center justify-center text-white text-[10px] font-bold`}>
                    {card.username[0].toUpperCase()}
                </div>
                <span className="text-xs text-slate-500">{card.username}</span>
            </div>
        </article>
    );
};
