import React from 'react';
import { Link } from 'react-router-dom';
import { Calendar, History, Info, List, Pencil, Plane, Printer, Route, Share2, Star } from 'lucide-react';

import { getAnalyticsDebugAttributes } from '../../services/analyticsService';

interface TripViewHeaderProps {
    isMobile: boolean;
    tripTitle: string;
    tripSummary: string;
    titleViewTransitionName: string | null;
    isEditingTitle: boolean;
    editTitleValue: string;
    onEditTitleValueChange: (value: string) => void;
    onCommitTitleEdit: () => void;
    onStartTitleEdit: () => void;
    editTitleInputRef: React.RefObject<HTMLInputElement | null>;
    canManageTripMetadata: boolean;
    canEdit: boolean;
    isFavorite: boolean;
    onToggleFavorite: () => void;
    onHeaderAuthAction: () => void;
    isHeaderAuthSubmitting: boolean;
    canUseAuthenticatedSession: boolean;
    onOpenTripInfo: () => void;
    onPrewarmTripInfo: () => void;
    onSetPrintMode: () => void;
    onOpenHistoryPanel: (source: 'desktop_header' | 'mobile_header') => void;
    onOpenManager: () => void;
    canShare: boolean;
    onShare: () => void;
    isTripLockedByExpiry: boolean;
}

export const TripViewHeader: React.FC<TripViewHeaderProps> = ({
    isMobile,
    tripTitle,
    tripSummary,
    titleViewTransitionName,
    isEditingTitle,
    editTitleValue,
    onEditTitleValueChange,
    onCommitTitleEdit,
    onStartTitleEdit,
    editTitleInputRef,
    canManageTripMetadata,
    canEdit,
    isFavorite,
    onToggleFavorite,
    onHeaderAuthAction,
    isHeaderAuthSubmitting,
    canUseAuthenticatedSession,
    onOpenTripInfo,
    onPrewarmTripInfo,
    onSetPrintMode,
    onOpenHistoryPanel,
    onOpenManager,
    canShare,
    onShare,
    isTripLockedByExpiry,
}) => {
    const titleStyle = titleViewTransitionName
        ? ({ viewTransitionName: titleViewTransitionName } as React.CSSProperties)
        : undefined;

    return (
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 sm:px-6 z-30 shrink-0">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                <Link
                    to="/"
                    className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity shrink-0"
                    title="Go to Homepage"
                    aria-label="Go to Homepage"
                >
                    <div className="w-8 h-8 bg-accent-600 rounded-lg flex items-center justify-center shadow-accent-200 shadow-lg transform rotate-3">
                        <Plane className="text-white transform -rotate-3" size={18} fill="currentColor" />
                    </div>
                    <span className="font-bold text-xl tracking-tight text-gray-900 hidden sm:block">Travel<span className="text-accent-600">Flow</span></span>
                </Link>
                <div className="h-6 w-px bg-gray-200 mx-2 hidden sm:block" />
                <div className="flex items-start gap-2 min-w-0">
                    <div className="flex flex-col leading-tight min-w-0">
                        {!isMobile && isEditingTitle ? (
                            <input
                                ref={editTitleInputRef}
                                value={editTitleValue}
                                onChange={(event) => onEditTitleValueChange(event.target.value)}
                                onBlur={onCommitTitleEdit}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter') {
                                        onCommitTitleEdit();
                                    }
                                }}
                                className="font-bold text-lg text-gray-900 bg-transparent border-b-2 border-accent-500 outline-none pb-0.5"
                            />
                        ) : !isMobile && canManageTripMetadata ? (
                            <button
                                type="button"
                                className="group flex items-center gap-2 cursor-pointer text-left"
                                onClick={onStartTitleEdit}
                                aria-label="Edit trip title"
                            >
                                <h1 className="font-bold text-lg text-gray-900 truncate max-w-[56vw] sm:max-w-md" style={titleStyle}>
                                    {tripTitle}
                                </h1>
                                <Pencil size={14} className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </button>
                        ) : (
                            <div className="flex items-center gap-2">
                                <h1 className="font-bold text-lg text-gray-900 truncate max-w-[56vw] sm:max-w-md" style={titleStyle}>
                                    {tripTitle}
                                </h1>
                            </div>
                        )}
                        {!isMobile && <div className="text-xs font-semibold text-accent-600 mt-0.5">{tripSummary}</div>}
                    </div>
                    {!isMobile && canManageTripMetadata && (
                        <button
                            type="button"
                            onClick={onToggleFavorite}
                            disabled={!canEdit}
                            className={`mt-0.5 p-1.5 rounded-lg transition-colors ${canEdit ? 'hover:bg-amber-50' : 'opacity-50 cursor-not-allowed'}`}
                            title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                            aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                        >
                            <Star
                                size={17}
                                className={isFavorite ? 'text-amber-500 fill-amber-400' : 'text-gray-300 hover:text-amber-500'}
                            />
                        </button>
                    )}
                </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                <button
                    type="button"
                    onClick={onHeaderAuthAction}
                    disabled={isHeaderAuthSubmitting}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    aria-label={canUseAuthenticatedSession ? 'Logout' : 'Login'}
                >
                    {canUseAuthenticatedSession ? 'Logout' : 'Login'}
                </button>
                <button
                    type="button"
                    onClick={onOpenTripInfo}
                    onMouseEnter={onPrewarmTripInfo}
                    onFocus={onPrewarmTripInfo}
                    onTouchStart={onPrewarmTripInfo}
                    className="p-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg"
                    aria-label="Trip information"
                >
                    <Info size={18} />
                </button>
                {!isMobile && (
                    <>
                        <div className="bg-gray-100 p-1 rounded-lg flex items-center mr-1">
                            <button type="button" onClick={onSetPrintMode} className="p-1.5 text-gray-500 hover:text-gray-700 rounded-md" aria-label="Print view">
                                <Printer size={18} />
                            </button>
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                onOpenHistoryPanel('desktop_header');
                            }}
                            className="p-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg"
                            aria-label="History"
                            {...getAnalyticsDebugAttributes('app__trip_history--open', { source: 'desktop_header' })}
                        >
                            <History size={18} />
                        </button>
                    </>
                )}
                {!isMobile && (
                    <button
                        type="button"
                        onClick={onOpenManager}
                        className="flex items-center gap-2 rounded-lg font-medium p-2 text-gray-500 hover:bg-gray-100 text-sm"
                        aria-label="My plans"
                    >
                        <Route size={18} />
                        <span className="hidden lg:inline">My Plans</span>
                    </button>
                )}
                {canShare && (
                    <button
                        type="button"
                        onClick={onShare}
                        disabled={isTripLockedByExpiry}
                        title={isTripLockedByExpiry ? 'Sharing is disabled for expired trips' : undefined}
                        className={`rounded-lg shadow-sm flex items-center gap-2 text-sm font-medium ${isMobile ? 'p-2' : 'px-4 py-2'} ${
                            isTripLockedByExpiry
                                ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                : 'bg-accent-600 text-white hover:bg-accent-700'
                        }`}
                    >
                        <Share2 size={16} />
                        <span className={isMobile ? 'sr-only' : 'hidden sm:inline'}>Share</span>
                    </button>
                )}
                {isMobile && (
                    <button
                        type="button"
                        onClick={() => {
                            onOpenHistoryPanel('mobile_header');
                        }}
                        className="p-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg"
                        aria-label="History"
                        {...getAnalyticsDebugAttributes('app__trip_history--open', { source: 'mobile_header' })}
                    >
                        <History size={18} />
                    </button>
                )}
                {isMobile && (
                    <button
                        type="button"
                        onClick={onOpenManager}
                        className="flex items-center gap-2 rounded-lg font-medium p-2 bg-gray-100 text-gray-700 hover:bg-gray-200"
                        aria-label="My plans"
                    >
                        <Route size={18} />
                        <span className="sr-only">My Plans</span>
                    </button>
                )}
            </div>
        </header>
    );
};
