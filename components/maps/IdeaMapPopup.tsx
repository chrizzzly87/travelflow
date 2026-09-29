import React, { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ExternalLink, MapPin, X } from 'lucide-react';

import type { MapIdeaMarker } from '../../shared/tripIdeas';
import { ActivityTypeIcon } from '../ActivityTypeVisuals';
import { formatActivityTypeLabel, getActivityTypePaletteClass } from '../ActivityTypeVisualsUtils';
import { Button } from '../ui/button';
import { MapAppLinks } from './MapAppLinks';
import type { MapMarkerAnchor } from './useMapMarkerAnchor';

/**
 * The card that opens on an idea pin: decide right there, without leaving the
 * map. Saving keeps the place as a saved idea with a full pin; it never turns
 * it into an activity.
 *
 * Same contract as `ActivityMapPopup`: a non-modal popover with a label,
 * Escape, outside-click dismissal and no focus trap, so the map stays usable.
 */

const POPUP_WIDTH = 284;
const POPUP_GAP = 16;

export type IdeaMapAction = 'save' | 'unsave' | 'skip';

export interface IdeaMapPopupProps {
    idea: MapIdeaMarker;
    anchor: MapMarkerAnchor;
    containerSize: { width: number; height: number };
    canEdit: boolean;
    onClose: () => void;
    onAction: (ideaId: string, action: IdeaMapAction) => void;
}

export const IdeaMapPopup: React.FC<IdeaMapPopupProps> = ({
    idea,
    anchor,
    containerSize,
    canEdit,
    onClose,
    onAction,
}) => {
    const { t } = useTranslation('common');
    const popupRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        popupRef.current?.focus();
    }, [idea.id]);

    const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.key !== 'Escape') return;
        event.stopPropagation();
        onClose();
    }, [onClose]);

    useEffect(() => {
        const handlePointerDown = (event: PointerEvent) => {
            const target = event.target;
            if (target instanceof Node && popupRef.current?.contains(target)) return;
            onClose();
        };
        // Capture phase: the map swallows pointer events on its own overlays.
        document.addEventListener('pointerdown', handlePointerDown, true);
        return () => document.removeEventListener('pointerdown', handlePointerDown, true);
    }, [onClose]);

    const left = Math.min(
        Math.max(anchor.x, POPUP_WIDTH / 2 + 8),
        Math.max(containerSize.width - POPUP_WIDTH / 2 - 8, POPUP_WIDTH / 2 + 8),
    );
    const shouldFlipBelow = anchor.top < 240;
    const top = shouldFlipBelow ? anchor.bottom + POPUP_GAP : anchor.top - POPUP_GAP;

    return (
        <div
            ref={popupRef}
            role="dialog"
            aria-label={t('tripView.ideas.popupLabel', { title: idea.title })}
            tabIndex={-1}
            onKeyDown={handleKeyDown}
            className="pointer-events-auto absolute z-30 rounded-xl border border-border bg-card p-3 shadow-2xl outline-none focus-visible:ring-2 focus-visible:ring-accent-400 dark:shadow-none"
            style={{
                insetInlineStart: `${left}px`,
                top: `${top}px`,
                width: `${POPUP_WIDTH}px`,
                transform: shouldFlipBelow ? 'translate(-50%, 0)' : 'translate(-50%, -100%)',
            }}
            data-testid="idea-map-popup"
            data-idea-review={idea.pending ? 'pending' : 'saved'}
        >
            <div className="flex items-start gap-2">
                <span
                    className={`flex size-7 shrink-0 items-center justify-center rounded-lg border border-dashed ${getActivityTypePaletteClass(idea.type)}`}
                    aria-hidden="true"
                >
                    <ActivityTypeIcon type={idea.type} size={14} />
                </span>
                <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground" title={idea.title}>{idea.title}</p>
                    <p className="text-[11px] font-medium text-muted-foreground">
                        {[formatActivityTypeLabel(idea.type), idea.cityName].filter(Boolean).join(' · ')}
                        {' · '}
                        <span className={idea.pending ? 'text-amber-600 dark:text-amber-300' : 'text-accent-600 dark:text-accent-300'}>
                            {t(idea.pending ? 'tripView.ideas.statusToReview' : 'tripView.ideas.statusSaved')}
                        </span>
                    </p>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    className="-me-1 -mt-1 rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary dark:text-foreground"
                    aria-label={t('tripView.mapLinks.close')}
                >
                    <X size={14} />
                </button>
            </div>

            {idea.summary && (
                <p className="mt-2 line-clamp-3 text-xs leading-5 text-foreground">{idea.summary}</p>
            )}

            {idea.address && (
                <p className="mt-1.5 flex items-start gap-1.5 text-xs text-muted-foreground">
                    <MapPin size={13} className="mt-0.5 shrink-0 text-accent-500" aria-hidden="true" />
                    <span className="min-w-0 break-words">{idea.address}</span>
                </p>
            )}

            {idea.source && (
                <a
                    href={idea.source.url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="mt-1.5 inline-flex max-w-full items-center gap-1 text-[11px] font-medium text-accent-700 underline decoration-accent-300 underline-offset-2 dark:text-accent-200"
                >
                    <ExternalLink size={11} aria-hidden="true" />
                    <span className="truncate">{idea.source.label}</span>
                </a>
            )}

            <MapAppLinks
                title={idea.title}
                location={idea.address ?? undefined}
                coordinates={{ lat: idea.lat, lng: idea.lng }}
                source="idea_popup"
                size="sm"
                className="mt-3"
            />

            {canEdit && (
                <div className="mt-3 flex gap-2">
                    {/* Save is always the main action. Once saved it reads as pressed, and pressing it again undoes the save. */}
                    <Button
                        type="button"
                        size="sm"
                        variant={idea.pending ? 'default' : 'soft'}
                        className="flex-[3]"
                        aria-pressed={!idea.pending}
                        title={idea.pending ? undefined : t('tripView.ideas.unsave')}
                        onClick={() => onAction(idea.id, idea.pending ? 'save' : 'unsave')}
                        data-testid="idea-map-popup-save"
                    >
                        <Check />
                        {t(idea.pending ? 'tripView.ideas.keep' : 'tripView.ideas.statusSaved')}
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="flex-[2]"
                        onClick={() => onAction(idea.id, 'skip')}
                        data-testid="idea-map-popup-skip"
                    >
                        <X />
                        {t('tripView.ideas.skip')}
                    </Button>
                </div>
            )}

        </div>
    );
};
