import React from 'react';
import { Link } from 'react-router-dom';
import { trackEvent } from '../../services/analyticsService';

export const CtaBanner: React.FC = () => {
    return (
        <section className="pb-16 md:pb-24 animate-scroll-scale-in">
            <div className="relative rounded-3xl bg-gradient-to-br from-accent-600 to-accent-800 px-8 py-14 text-center md:px-16 md:py-20 overflow-hidden">
                {/* Decorative glow orbs */}
                <div className="pointer-events-none absolute -top-20 -right-20 h-60 w-60 rounded-full bg-white/10 blur-[60px]" />
                <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-accent-400/20 blur-[50px]" />

                <h2 className="relative text-3xl font-black tracking-tight text-white md:text-5xl" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                    Ready to plan your next trip?
                </h2>
                <p className="relative mx-auto mt-4 max-w-xl text-base text-accent-100 md:text-lg">
                    Join thousands of travelers who build smarter itineraries in minutes. No account needed to start.
                </p>
                <Link
                    to="/create-trip"
                    onClick={() =>
                        trackEvent('home__bottom_cta')
                    }
                    className="relative mt-8 inline-block rounded-2xl bg-white px-8 py-3.5 text-base font-bold text-accent-700 shadow-lg transition-all hover:shadow-xl hover:bg-accent-50 hover:scale-[1.03] active:scale-[0.98]"
                >
                    Start Planning — It&apos;s Free
                </Link>
            </div>
        </section>
    );
};
