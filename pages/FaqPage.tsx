import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { MarketingLayout } from '../components/marketing/MarketingLayout';
import { FaqAccordionList } from '../components/marketing/FaqAccordionList';
import { DEFAULT_LOCALE } from '../config/locales';
import { buildLocalizedMarketingPath, extractLocaleFromPath } from '../config/routes';
import {
    getAnalyticsDebugAttributes,
    trackEvent,
} from '../services/analyticsService';
import {
    FAQ_SECTIONS,
    getFaqItemById,
    type FaqItemWithSection,
} from '../data/faqContent';

const normalizeHashId = (hash: string): string => (
    decodeURIComponent((hash || '').replace(/^#/, '').trim())
);

export const FaqPage: React.FC = () => {
    const location = useLocation();
    const locale = extractLocaleFromPath(location.pathname) ?? DEFAULT_LOCALE;
    const [openItemIds, setOpenItemIds] = useState<string[]>(() => {
        const firstItemId = FAQ_SECTIONS[0]?.items[0]?.id;
        return firstItemId ? [firstItemId] : [];
    });
    const didTrackViewRef = useRef(false);
    const lastHashOpenedRef = useRef<string | null>(null);

    const faqSections = useMemo(
        () => FAQ_SECTIONS.map((section) => ({
            ...section,
            itemsWithSection: section.items.map((item): FaqItemWithSection => ({
                ...item,
                sectionId: section.id,
                sectionTitle: section.title,
            })),
        })),
        []
    );

    useEffect(() => {
        if (didTrackViewRef.current) return;
        didTrackViewRef.current = true;
        trackEvent('faq__view', {
            locale,
            hash: normalizeHashId(location.hash) || null,
        });
    }, [locale, location.hash]);

    const handleHashNavigation = useCallback((rawHash: string) => {
        const hashId = normalizeHashId(rawHash);
        if (!hashId) return;

        const matchedItem = getFaqItemById(hashId);
        if (matchedItem) {
            setOpenItemIds((current) => (current.length === 1 && current[0] === hashId ? current : [hashId]));

            if (lastHashOpenedRef.current !== hashId) {
                trackEvent('faq__item--open', {
                    item_id: hashId,
                    section_id: matchedItem.sectionId,
                    source: 'hash',
                });
                lastHashOpenedRef.current = hashId;
            }
        }

        const target = document.getElementById(hashId);
        if (!target) return;
        window.requestAnimationFrame(() => {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
            });
        });
    }, []);

    useEffect(() => {
        handleHashNavigation(location.hash);
    }, [handleHashNavigation, location.hash]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const onHashChange = () => {
            handleHashNavigation(window.location.hash);
        };
        window.addEventListener('hashchange', onHashChange);
        return () => window.removeEventListener('hashchange', onHashChange);
    }, [handleHashNavigation]);

    const handleSectionLinkClick = (sectionId: string) => {
        trackEvent('faq__section_link', {
            section_id: sectionId,
            source: 'toc',
        });
    };

    const handleItemToggle = (item: FaqItemWithSection, nextOpen: boolean) => {
        setOpenItemIds((current) => {
            if (nextOpen) return [item.id];
            return current.filter((entry) => entry !== item.id);
        });

        trackEvent(nextOpen ? 'faq__item--open' : 'faq__item--close', {
            item_id: item.id,
            section_id: item.sectionId,
            source: 'faq_page',
        });

        if (!nextOpen || typeof window === 'undefined') return;
        window.history.replaceState(window.history.state, '', `${location.pathname}#${item.id}`);
    };

    const contactPath = buildLocalizedMarketingPath('contact', locale);

    return (
        <MarketingLayout>
            <section className="pb-8 md:pb-12">
                <h1 className="text-4xl font-black tracking-tight text-slate-900 md:text-6xl">
                    Frequently asked questions.
                </h1>
                <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600 md:text-base">
                    Find quick answers for support, billing, privacy, and planning questions.
                </p>

                <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold text-slate-700">
                    {faqSections.map((section) => (
                        <a
                            key={section.id}
                            href={`#${section.id}`}
                            onClick={() => handleSectionLinkClick(section.id)}
                            className="underline decoration-transparent underline-offset-4 transition-colors hover:text-slate-900 hover:decoration-slate-500"
                            {...getAnalyticsDebugAttributes('faq__section_link', {
                                section_id: section.id,
                                source: 'toc',
                            })}
                        >
                            {section.title}
                        </a>
                    ))}
                </div>
            </section>

            <div className="border-t border-slate-200">
                {faqSections.map((section) => (
                    <section key={section.id} id={section.id} className="scroll-mt-28 border-b border-slate-200 py-10 md:py-12">
                        <div className="grid gap-6 md:grid-cols-[220px,minmax(0,1fr)] md:gap-8">
                            <h2 className="text-3xl font-bold tracking-tight text-slate-900 md:text-[2rem]">
                                {section.title}
                            </h2>
                            <FaqAccordionList
                                items={section.itemsWithSection}
                                openItemIds={openItemIds}
                                onToggle={handleItemToggle}
                                variant="plain"
                                getItemButtonProps={(item) =>
                                    getAnalyticsDebugAttributes('faq__item--open', {
                                        item_id: item.id,
                                        section_id: item.sectionId,
                                        source: 'faq_page',
                                    })
                                }
                            />
                        </div>
                    </section>
                ))}
            </div>

            <section className="pt-10 md:pt-12">
                <h2 className="text-xl font-bold text-slate-900 md:text-2xl">Still need help?</h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                    Contact us with your question and we will route it to the right team.
                </p>
                <Link
                    to={contactPath}
                    onClick={() => trackEvent('faq__cta--contact', { source: 'faq_page' })}
                    className="mt-4 inline-flex items-center rounded-lg bg-accent-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-700"
                    {...getAnalyticsDebugAttributes('faq__cta--contact', { source: 'faq_page' })}
                >
                    Open Contact
                </Link>
            </section>
        </MarketingLayout>
    );
};
