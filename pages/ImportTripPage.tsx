import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle, ClipboardText, CopySimple, Sparkle } from '@phosphor-icons/react';
import { useNavigate } from '@/app/navigation';
import { MarketingLayout } from '../components/marketing/MarketingLayout';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import { getAnalyticsDebugAttributes, trackEvent } from '../services/analyticsService';
import { createTripDraftFromText, TripDraftRequestError } from '../services/tripDraftService';

type ImportError = { title: string; body: string; details: string[] };

/**
 * For chats that cannot call TravelFlow themselves: the assistant prints the
 * trip JSON (llms.txt tells it how), the traveller pastes it here, and it
 * becomes a draft like one sent over MCP. No model runs on our side.
 */
export const ImportTripPage: React.FC = () => {
    const { t } = useTranslation('createTrip');
    const navigate = useNavigate();
    const [text, setText] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<ImportError | null>(null);
    const [promptCopied, setPromptCopied] = useState(false);
    const assistantPrompt = t('importTrip.prompt.text', { url: 'https://travelflowapp.netlify.app/llms.txt' });

    const handleCopyPrompt = async () => {
        trackEvent('trip_import__prompt--copy');
        try {
            await navigator.clipboard.writeText(assistantPrompt);
            setPromptCopied(true);
        } catch {
            setPromptCopied(false);
        }
    };

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!text.trim()) return;
        setIsSubmitting(true);
        setError(null);
        trackEvent('trip_import__submit', { characters: text.length });
        try {
            const result = await createTripDraftFromText(text);
            trackEvent('trip_import__submit--success');
            navigate(`/draft/${result.draftId}`);
        } catch (caught) {
            const code = caught instanceof TripDraftRequestError ? caught.code : 'unknown';
            trackEvent('trip_import__submit--error', { code });
            if (code === 'invalid_json') {
                setError({ title: t('importTrip.errors.invalidJsonTitle'), body: t('importTrip.errors.invalidJsonBody'), details: [] });
            } else if (code === 'validation_failed' && caught instanceof TripDraftRequestError) {
                setError({ title: t('importTrip.errors.validationTitle'), body: t('importTrip.errors.validationBody'), details: caught.errors });
            } else if (code === 'rate_limited') {
                setError({ title: t('importTrip.errors.rateLimitedTitle'), body: t('importTrip.errors.rateLimitedBody'), details: [] });
            } else {
                setError({ title: t('importTrip.errors.genericTitle'), body: t('importTrip.errors.genericBody'), details: [] });
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <MarketingLayout>
            <section className="mx-auto max-w-2xl space-y-6">
                <header>
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-accent-700 dark:text-accent-200">{t('importTrip.eyebrow')}</p>
                    <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground text-balance">{t('importTrip.title')}</h1>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground text-pretty">{t('importTrip.intro')}</p>
                </header>

                <div className="rounded-2xl border border-border bg-card p-5 shadow-sm dark:shadow-none">
                    <div className="flex items-start gap-3">
                        <Sparkle size={20} weight="duotone" className="mt-0.5 shrink-0 text-accent-600 dark:text-accent-300" aria-hidden />
                        <div className="min-w-0 flex-1">
                            <h2 className="text-sm font-semibold text-foreground">{t('importTrip.prompt.title')}</h2>
                            <p className="mt-1 text-sm leading-6 text-muted-foreground">{t('importTrip.prompt.body')}</p>
                            <p className="mt-3 rounded-lg bg-secondary px-3 py-2 text-sm leading-6 text-foreground [overflow-wrap:anywhere]">{assistantPrompt}</p>
                            <div className="mt-3 flex justify-end">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={handleCopyPrompt}
                                    {...getAnalyticsDebugAttributes('trip_import__prompt--copy')}
                                >
                                    {promptCopied ? <CheckCircle size={14} weight="duotone" /> : <CopySimple size={14} weight="duotone" />}
                                    {promptCopied ? t('importTrip.prompt.copied') : t('importTrip.prompt.copy')}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl border border-border bg-card p-5 shadow-sm dark:shadow-none">
                    <label htmlFor="import-trip-json" className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        <ClipboardText size={18} weight="duotone" aria-hidden />
                        {t('importTrip.field.label')}
                    </label>
                    <p id="import-trip-json-hint" className="text-sm leading-6 text-muted-foreground">{t('importTrip.field.hint')}</p>
                    <Textarea
                        id="import-trip-json"
                        value={text}
                        onChange={(event) => setText(event.target.value)}
                        aria-describedby="import-trip-json-hint"
                        aria-invalid={error ? true : undefined}
                        spellCheck={false}
                        autoComplete="off"
                        rows={12}
                        className="min-h-64 max-h-[60vh] font-mono text-xs"
                        /* A code sample, not copy: the same in every language. */
                        placeholder={'{ "trip": { "tripTitle": … } }'}
                    />
                    {error && (
                        <Alert variant="destructive" role="alert">
                            <AlertTitle>{error.title}</AlertTitle>
                            <AlertDescription>
                                <p>{error.body}</p>
                                {error.details.length > 0 && (
                                    <ul className="mt-2 list-disc space-y-1 ps-5 font-mono text-xs" dir="ltr">
                                        {error.details.slice(0, 12).map((detail) => <li key={detail}>{detail}</li>)}
                                    </ul>
                                )}
                            </AlertDescription>
                        </Alert>
                    )}
                    <div className="flex justify-end">
                        <Button
                            type="submit"
                            loading={isSubmitting}
                            disabled={!text.trim()}
                            {...getAnalyticsDebugAttributes('trip_import__submit')}
                        >
                            {t('importTrip.submit')}
                        </Button>
                    </div>
                </form>
            </section>
        </MarketingLayout>
    );
};
