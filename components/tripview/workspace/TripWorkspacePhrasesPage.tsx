import React from 'react';
import { Copy, Headphones, Sparkle, Swap } from '@phosphor-icons/react';

import type { ITrip, TripWorkspaceContextSelection } from '../../../types';
import { getAnalyticsDebugAttributes, trackEvent } from '../../../services/analyticsService';
import {
    type PhraseCategory,
    type PhraseReviewRating,
    getTripWorkspacePhraseCardsForCategory,
    type TripWorkspaceDemoDataset,
    type TripWorkspacePhraseCard,
} from './tripWorkspaceDemoData';
import { resolveTripWorkspaceContextSnapshot } from './tripWorkspaceContext';
import { resolveTripWorkspaceFallbackTripMeta, useTripWorkspacePageContext } from './tripWorkspacePageContext';
import { TripWorkspaceRouteContextBar } from './TripWorkspaceRouteContextBar';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';
import { Tabs, TabsList, TabsTrigger } from '../../ui/tabs';

interface TripMetaSummary {
    dateRange: string;
    totalDaysLabel: string;
    cityCount: number;
    distanceLabel: string | null;
    summaryLine: string;
}

interface TripWorkspacePhrasesPageProps {
    trip: ITrip;
    tripMeta?: TripMetaSummary;
    dataset?: TripWorkspaceDemoDataset;
    contextSelection?: TripWorkspaceContextSelection;
    onContextSelectionChange?: (next: TripWorkspaceContextSelection) => void;
}

const CATEGORY_ORDER: PhraseCategory[] = ['basics', 'transport', 'food', 'emergency'];
const CATEGORY_LABELS: Record<PhraseCategory, string> = {
    basics: 'Basics',
    transport: 'Transport',
    food: 'Food',
    emergency: 'Emergency',
};

export const TripWorkspacePhrasesPage: React.FC<TripWorkspacePhrasesPageProps> = ({
    trip,
    tripMeta = resolveTripWorkspaceFallbackTripMeta(trip),
    dataset,
    contextSelection,
    onContextSelectionChange,
}) => {
    const pageTripMeta = React.useMemo(
        () => tripMeta ?? resolveTripWorkspaceFallbackTripMeta(trip),
        [trip, tripMeta],
    );
    const {
        dataset: pageDataset,
        contextSelection: pageContextSelection,
        onContextSelectionChange: handleContextSelectionChange,
    } = useTripWorkspacePageContext({
        trip,
        dataset,
        contextSelection,
        onContextSelectionChange,
    });
    const context = React.useMemo(
        () => resolveTripWorkspaceContextSnapshot(pageDataset, pageContextSelection),
        [pageContextSelection, pageDataset],
    );
    const activeCountry = context.activeCountry;
    const languageCards = React.useMemo(
        () => pageDataset.phrases.filter((card) => !activeCountry || card.countryCode === activeCountry.code),
        [activeCountry, pageDataset.phrases],
    );
    const availableLanguages = React.useMemo(() => {
        const seen = new Map<string, { code: string; name: string; countryCode: string | null }>();
        languageCards.forEach((card) => {
            const key = card.languageCode ?? card.countryCode ?? card.id;
            if (seen.has(key)) return;
            seen.set(key, {
                code: card.languageCode ?? key,
                name: card.languageName ?? activeCountry?.languageName ?? 'Local language',
                countryCode: card.countryCode ?? null,
            });
        });
        return Array.from(seen.values());
    }, [activeCountry?.languageName, languageCards]);

    const [activeCategory, setActiveCategory] = React.useState<PhraseCategory>('basics');
    const [activeLanguageCode, setActiveLanguageCode] = React.useState<string>(() => (
        availableLanguages[0]?.code ?? activeCountry?.languageCode ?? 'route'
    ));
    const [savedIds, setSavedIds] = React.useState<string[]>(['thai-hello', 'thai-reservation']);
    const [flippedIds, setFlippedIds] = React.useState<string[]>([]);
    const [reviewRatings, setReviewRatings] = React.useState<Record<string, PhraseReviewRating>>({});

    React.useEffect(() => {
        setActiveLanguageCode(availableLanguages[0]?.code ?? activeCountry?.languageCode ?? 'route');
    }, [activeCountry?.languageCode, availableLanguages]);

    const activeCards = React.useMemo(() => (
        getTripWorkspacePhraseCardsForCategory(pageDataset, activeCategory, activeCountry?.code)
            .filter((card) => activeLanguageCode === 'route' || (card.languageCode ?? card.countryCode) === activeLanguageCode)
    ), [activeCategory, activeCountry?.code, activeLanguageCode, pageDataset]);

    const handleFlip = React.useCallback((cardId: string) => {
        setFlippedIds((current) => current.includes(cardId)
            ? current.filter((id) => id !== cardId)
            : [...current, cardId]);
    }, []);

    const handleSave = React.useCallback((cardId: string) => {
        setSavedIds((current) => current.includes(cardId)
            ? current.filter((id) => id !== cardId)
            : [...current, cardId]);
        trackEvent('trip_workspace__phrase_save--toggle', {
            trip_id: trip.id,
            phrase_id: cardId,
        });
    }, [trip.id]);

    const handleCopy = React.useCallback(async (phrase: TripWorkspacePhraseCard) => {
        if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) return;
        await navigator.clipboard.writeText(`${phrase.phrase} — ${phrase.local}`);
        trackEvent('trip_workspace__phrase_copy--trigger', {
            trip_id: trip.id,
            phrase_id: phrase.id,
        });
    }, [trip.id]);

    const handleSpeak = React.useCallback((phrase: TripWorkspacePhraseCard) => {
        if (typeof window === 'undefined' || typeof window.SpeechSynthesisUtterance === 'undefined') return;
        const utterance = new window.SpeechSynthesisUtterance(phrase.local);
        window.speechSynthesis?.cancel();
        window.speechSynthesis?.speak(utterance);
        trackEvent('trip_workspace__phrase_speak--trigger', {
            trip_id: trip.id,
            phrase_id: phrase.id,
        });
    }, [trip.id]);

    const handleReview = React.useCallback((cardId: string, rating: PhraseReviewRating) => {
        setReviewRatings((current) => ({ ...current, [cardId]: rating }));
        trackEvent('trip_workspace__phrase_review--rate', {
            trip_id: trip.id,
            phrase_id: cardId,
            rating,
        });
    }, [trip.id]);

    const dueTodayCount = languageCards.filter((card) => reviewRatings[card.id] !== 'easy').length + 2;
    const practiceAgainCount = Object.values(reviewRatings).filter((rating) => rating === 'practice').length;
    const activeLanguage = availableLanguages.find((language) => language.code === activeLanguageCode) ?? availableLanguages[0] ?? null;

    return (
        <div className="flex flex-col gap-4">
            <TripWorkspaceRouteContextBar
                tripId={trip.id}
                page="phrases"
                dataset={pageDataset}
                tripMeta={pageTripMeta}
                selection={pageContextSelection}
                onSelectionChange={handleContextSelectionChange}
            />

            <div className="grid gap-4 xl:grid-cols-[1.12fr_0.88fr]">
                <Card className="border-border/80 bg-card/95 shadow-sm">
                    <CardHeader className="gap-3">
                        <div className="flex flex-wrap gap-2">
                            <Badge variant="secondary">Language support</Badge>
                            <Badge variant="outline">{activeCountry?.languageName ?? 'Route language pack'}</Badge>
                            <Badge variant="outline">Demo flashcards</Badge>
                        </div>
                        <CardDescription>Phrase deck and flashcards</CardDescription>
                        <CardTitle>{activeLanguage?.name ?? activeCountry?.languageName ?? 'Local language'} for {context.activeCity?.title ?? activeCountry?.name ?? 'this route'}</CardTitle>
                        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                            Phrases now follow the current country by default, then let you narrow the deck by use-case without losing city relevance.
                        </p>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-4">
                        <Tabs value={activeLanguageCode} onValueChange={setActiveLanguageCode}>
                            <TabsList className="flex w-full flex-wrap justify-start">
                                {availableLanguages.map((language) => (
                                    <TabsTrigger key={language.code} value={language.code}>
                                        {language.name}
                                    </TabsTrigger>
                                ))}
                            </TabsList>
                        </Tabs>

                        <Tabs value={activeCategory} onValueChange={(value) => setActiveCategory(value as PhraseCategory)}>
                            <TabsList className="w-full justify-start overflow-x-auto">
                                {CATEGORY_ORDER.map((category) => (
                                    <TabsTrigger key={category} value={category}>{CATEGORY_LABELS[category]}</TabsTrigger>
                                ))}
                            </TabsList>
                        </Tabs>

                        <div className="flex flex-wrap gap-2">
                            {context.countryCities.map((city) => (
                                <Badge key={city.id} variant={city.id === context.activeCity?.id ? 'secondary' : 'outline'}>
                                    {city.title}
                                </Badge>
                            ))}
                        </div>

                        <div className="grid gap-3">
                            {activeCards.map((card) => {
                                const isFlipped = flippedIds.includes(card.id);
                                const isSaved = savedIds.includes(card.id);
                                const rating = reviewRatings[card.id] ?? 'new';
                                return (
                                    <Card key={card.id} className="overflow-hidden border-border/80 bg-background shadow-none">
                                        <button
                                            type="button"
                                            onClick={() => handleFlip(card.id)}
                                            className="w-full text-left"
                                        >
                                            <CardHeader className="gap-3">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <Badge variant="secondary">{CATEGORY_LABELS[card.category]}</Badge>
                                                    <Badge variant="outline">{card.usage}</Badge>
                                                    {card.cityId === context.activeCity?.id ? <Badge variant="outline">Current city</Badge> : null}
                                                </div>
                                                <CardDescription>{isFlipped ? card.pronunciation : 'Tap to flip the card'}</CardDescription>
                                                <CardTitle className="text-xl">
                                                    {isFlipped ? card.local : card.phrase}
                                                </CardTitle>
                                            </CardHeader>
                                        </button>
                                        <CardContent className="flex flex-col gap-4">
                                            <p className="text-sm leading-6 text-muted-foreground">
                                                {isFlipped ? card.phrase : card.local}
                                            </p>
                                            <div className="flex flex-wrap gap-2">
                                                <Button
                                                    type="button"
                                                    variant={isSaved ? 'outline' : 'default'}
                                                    onClick={() => handleSave(card.id)}
                                                    {...getAnalyticsDebugAttributes('trip_workspace__phrase_save--toggle', {
                                                        trip_id: trip.id,
                                                        phrase_id: card.id,
                                                    })}
                                                >
                                                    <Sparkle data-icon="inline-start" weight="duotone" />
                                                    {isSaved ? 'Saved to flashcards' : 'Save to flashcards'}
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    onClick={() => void handleCopy(card)}
                                                    {...getAnalyticsDebugAttributes('trip_workspace__phrase_copy--trigger', {
                                                        trip_id: trip.id,
                                                        phrase_id: card.id,
                                                    })}
                                                >
                                                    <Copy data-icon="inline-start" />
                                                    Copy
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    onClick={() => handleSpeak(card)}
                                                    {...getAnalyticsDebugAttributes('trip_workspace__phrase_speak--trigger', {
                                                        trip_id: trip.id,
                                                        phrase_id: card.id,
                                                    })}
                                                >
                                                    <Headphones data-icon="inline-start" />
                                                    Speak
                                                </Button>
                                                <Button type="button" variant="ghost" onClick={() => handleFlip(card.id)}>
                                                    <Swap data-icon="inline-start" weight="duotone" />
                                                    Flip
                                                </Button>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant={rating === 'easy' ? 'default' : 'outline'}
                                                    onClick={() => handleReview(card.id, 'easy')}
                                                    {...getAnalyticsDebugAttributes('trip_workspace__phrase_review--rate', {
                                                        trip_id: trip.id,
                                                        phrase_id: card.id,
                                                        rating: 'easy',
                                                    })}
                                                >
                                                    Easy
                                                </Button>
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant={rating === 'practice' ? 'default' : 'outline'}
                                                    onClick={() => handleReview(card.id, 'practice')}
                                                    {...getAnalyticsDebugAttributes('trip_workspace__phrase_review--rate', {
                                                        trip_id: trip.id,
                                                        phrase_id: card.id,
                                                        rating: 'practice',
                                                    })}
                                                >
                                                    Practice again
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>

                <div className="flex flex-col gap-4">
                    <Card className="border-border/80 bg-card/95 shadow-sm">
                        <CardHeader>
                            <CardDescription>Flashcard progress</CardDescription>
                            <CardTitle>Daily language support</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-3">
                            <div className="rounded-[1.5rem] border border-border/70 bg-background px-4 py-3">
                                <p className="text-sm font-medium text-foreground">Due today</p>
                                <p className="mt-1 text-2xl font-semibold text-foreground">{dueTodayCount}</p>
                            </div>
                            <div className="rounded-[1.5rem] border border-border/70 bg-background px-4 py-3">
                                <p className="text-sm font-medium text-foreground">Saved phrases</p>
                                <p className="mt-1 text-2xl font-semibold text-foreground">{savedIds.length + 18}</p>
                            </div>
                            <div className="rounded-[1.5rem] border border-border/70 bg-background px-4 py-3">
                                <p className="text-sm font-medium text-foreground">Practice again</p>
                                <p className="mt-1 text-2xl font-semibold text-foreground">{practiceAgainCount}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-border/80 bg-card/95 shadow-sm">
                        <CardHeader>
                            <CardDescription>Language pack logic</CardDescription>
                            <CardTitle>Keep phrase support anchored to the route</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-3 text-sm leading-6 text-muted-foreground">
                            <p>The active country decides the default language pack, so moving from Thailand to Cambodia or Vietnam also changes the deck automatically.</p>
                            <div className="rounded-[1.5rem] border border-border/70 bg-background px-4 py-3">
                                <p className="text-sm font-medium text-foreground">Current pack</p>
                                <p className="mt-2">{activeLanguage?.name ?? 'Route language'} for {activeCountry?.name ?? 'this route'} with {activeCards.length} visible cards in the active category.</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};
