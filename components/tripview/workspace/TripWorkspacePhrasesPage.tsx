import React from 'react';
import { Copy, Headphones, Sparkle, Swap } from '@phosphor-icons/react';

import type { ITrip } from '../../../types';
import { getAnalyticsDebugAttributes, trackEvent } from '../../../services/analyticsService';
import {
    PhraseCategory,
    type PhraseReviewRating,
    THAILAND_PHRASE_CARDS,
    buildTripWorkspaceCityGuides,
    getTripWorkspacePhraseCardsForCategory,
} from './tripWorkspaceDemoData';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';
import { Tabs, TabsList, TabsTrigger } from '../../ui/tabs';

interface TripWorkspacePhrasesPageProps {
    trip: ITrip;
}

const CATEGORY_ORDER: PhraseCategory[] = ['basics', 'transport', 'food', 'emergency'];
const CATEGORY_LABELS: Record<PhraseCategory, string> = {
    basics: 'Basics',
    transport: 'Transport',
    food: 'Food',
    emergency: 'Emergency',
};

export const TripWorkspacePhrasesPage: React.FC<TripWorkspacePhrasesPageProps> = ({ trip }) => {
    const cityGuides = React.useMemo(() => buildTripWorkspaceCityGuides(trip), [trip]);
    const [activeCategory, setActiveCategory] = React.useState<PhraseCategory>('basics');
    const [savedIds, setSavedIds] = React.useState<string[]>(['hello']);
    const [flippedIds, setFlippedIds] = React.useState<string[]>([]);
    const [reviewRatings, setReviewRatings] = React.useState<Record<string, PhraseReviewRating>>({});
    const activeCards = React.useMemo(() => getTripWorkspacePhraseCardsForCategory(activeCategory), [activeCategory]);

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

    const handleCopy = React.useCallback(async (phrase: typeof THAILAND_PHRASE_CARDS[number]) => {
        if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) return;
        await navigator.clipboard.writeText(`${phrase.phrase} — ${phrase.local}`);
        trackEvent('trip_workspace__phrase_copy--trigger', {
            trip_id: trip.id,
            phrase_id: phrase.id,
        });
    }, [trip.id]);

    const handleSpeak = React.useCallback((phrase: typeof THAILAND_PHRASE_CARDS[number]) => {
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

    const dueTodayCount = THAILAND_PHRASE_CARDS.filter((card) => reviewRatings[card.id] !== 'easy').length + 4;
    const practiceAgainCount = Object.values(reviewRatings).filter((rating) => rating === 'practice').length;

    return (
        <div className="grid gap-4 xl:grid-cols-[1.12fr_0.88fr]">
            <Card className="border-border/80 bg-card/95 shadow-sm">
                <CardHeader className="gap-3">
                    <CardDescription>Phrase deck and flashcards</CardDescription>
                    <CardTitle>Useful Thai for this route</CardTitle>
                    <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                        Save the phrases you actually need, flip the cards when you want the local side first, and use quick review buttons to keep the demo deck feeling alive.
                    </p>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                    <Tabs value={activeCategory} onValueChange={(value) => setActiveCategory(value as PhraseCategory)}>
                        <TabsList className="w-full justify-start overflow-x-auto">
                            {CATEGORY_ORDER.map((category) => (
                                <TabsTrigger key={category} value={category}>{CATEGORY_LABELS[category]}</TabsTrigger>
                            ))}
                        </TabsList>
                    </Tabs>
                    <div className="flex flex-wrap gap-2">
                        {cityGuides.map((city) => (
                            <Badge key={city.id} variant="outline">{city.title}</Badge>
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
                            <p className="mt-1 text-2xl font-semibold text-foreground">{savedIds.length + 28}</p>
                        </div>
                        <div className="rounded-[1.5rem] border border-border/70 bg-background px-4 py-3">
                            <p className="text-sm font-medium text-foreground">Practice again</p>
                            <p className="mt-1 text-2xl font-semibold text-foreground">{practiceAgainCount}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-border/80 bg-card/95 shadow-sm">
                    <CardHeader>
                        <CardDescription>Offline-ready demo</CardDescription>
                        <CardTitle>Why this page belongs in the workspace</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-3 text-sm leading-6 text-muted-foreground">
                        <p>Travel phrases should feel like a quick support tool, not a separate app or a static glossary.</p>
                        <p>This pass adds flashcard behavior, speaking, saving, and review states so the page feels like a real playground while live language services are still pending.</p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};
