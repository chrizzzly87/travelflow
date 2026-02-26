import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, LifeBuoy, Mail, WifiOff, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { normalizeLocale } from '../config/locales';
import { buildLocalizedMarketingPath } from '../config/routes';
import { getAnalyticsDebugAttributes, trackEvent } from '../services/analyticsService';
import { readSessionStorageItem, removeSessionStorageItem, writeSessionStorageItem } from '../services/browserStorageService';
import type { ConnectivitySnapshot } from '../services/supabaseHealthMonitor';
import type { SyncRunSnapshot } from '../services/tripSyncManager';
import { Spinner } from './ui/spinner';

const DISMISSED_STATE_STORAGE_KEY = 'tf_connectivity_banner_dismissed_state_v1';

interface ConnectivityStatusBannerProps {
  isPlannerRoute: boolean;
  connectivity: ConnectivitySnapshot;
  sync: SyncRunSnapshot;
  onRetrySync: () => void | Promise<unknown>;
  showDeveloperDetails?: boolean;
}

export const ConnectivityStatusBanner: React.FC<ConnectivityStatusBannerProps> = ({
  isPlannerRoute,
  connectivity,
  sync,
  onRetrySync,
  showDeveloperDetails = false,
}) => {
  const { t, i18n } = useTranslation('common');
  const [dismissedForState, setDismissedForState] = useState<string | null>(() => (
    readSessionStorageItem(DISMISSED_STATE_STORAGE_KEY)
  ));

  const hasPendingQueue = sync.pendingCount > 0;
  const hasRetryableFailures = sync.failedCount > 0;
  const showOutageState = connectivity.state !== 'online';
  const showSyncState = !showOutageState && (sync.isSyncing || hasPendingQueue);
  const isDismissed = dismissedForState === connectivity.state && showOutageState;
  const queueCountVariant = sync.pendingCount === 0 ? 'None' : (sync.pendingCount === 1 ? 'One' : 'Many');
  const syncCountVariant = sync.pendingCount === 1 ? 'One' : 'Many';
  const activeLocale = normalizeLocale(i18n.resolvedLanguage ?? i18n.language);
  const supportContactPath = buildLocalizedMarketingPath('contact', activeLocale);
  const supportEmail = t('contact.emailValue');
  const supportEmailHref = `mailto:${supportEmail}`;

  useEffect(() => {
    if (!showOutageState) return;
    if (dismissedForState && dismissedForState !== connectivity.state) {
      setDismissedForState(null);
      removeSessionStorageItem(DISMISSED_STATE_STORAGE_KEY);
    }
  }, [connectivity.state, dismissedForState, showOutageState]);

  const bannerTone = useMemo(() => {
    if (connectivity.state === 'offline') {
      return {
        wrapper: 'border-rose-200 bg-rose-50/80 text-rose-950',
        button: 'border-rose-300 bg-white text-rose-900 hover:bg-rose-100',
      };
    }
    if (connectivity.state === 'degraded') {
      return {
        wrapper: 'border-amber-200 bg-amber-50/85 text-amber-950',
        button: 'border-amber-300 bg-white text-amber-900 hover:bg-amber-100',
      };
    }
    return {
      wrapper: 'border-sky-200 bg-sky-50/80 text-sky-950',
      button: 'border-sky-300 bg-white text-sky-900 hover:bg-sky-100',
    };
  }, [connectivity.state]);

  if (!isPlannerRoute) return null;
  if (!showOutageState && !showSyncState) return null;
  if (isDismissed) return null;

  const title = showOutageState
    ? t(`connectivity.banner.${connectivity.state}.title`)
    : t('connectivity.banner.syncing.title');

  const message = showOutageState
    ? t(`connectivity.banner.${connectivity.state}.message${queueCountVariant}`, { count: sync.pendingCount })
    : t(`connectivity.banner.syncing.message${syncCountVariant}`, { count: sync.pendingCount });

  const syncingProgressLabel = t(`connectivity.banner.syncing.progress${syncCountVariant}`, { count: sync.pendingCount });

  return (
    <div className={`border-b px-4 py-2 sm:px-6 ${bannerTone.wrapper}`}>
      <div className="mx-auto w-full max-w-[1200px]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {connectivity.state === 'offline' ? (
                <WifiOff className="h-4 w-4 shrink-0" />
              ) : connectivity.state === 'degraded' ? (
                <AlertTriangle className="h-4 w-4 shrink-0" />
              ) : (
                <Spinner className="h-4 w-4 shrink-0" />
              )}
              <p className="text-sm font-semibold">{title}</p>
            </div>
            <p className="mt-1 text-xs opacity-95 sm:text-sm">{message}</p>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] opacity-90">
              {showOutageState && (
                <span className="inline-flex items-center gap-1">
                  <Spinner className="h-3.5 w-3.5" />
                  {t('connectivity.banner.retryHint')}
                </span>
              )}
              {sync.isSyncing && (
                <span>{syncingProgressLabel}</span>
              )}
              {showDeveloperDetails && connectivity.isForced && (
                <span>{t('connectivity.banner.forcedMode')}</span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {hasRetryableFailures && (
              <button
                type="button"
                onClick={() => {
                  trackEvent('trip_connectivity__banner--retry_sync', {
                    pending_count: sync.pendingCount,
                    failed_count: sync.failedCount,
                    connectivity_state: connectivity.state,
                  });
                  void onRetrySync();
                }}
                className={`inline-flex h-8 items-center rounded-md border px-3 text-xs font-semibold ${bannerTone.button}`}
                {...getAnalyticsDebugAttributes('trip_connectivity__banner--retry_sync', {
                  pending_count: sync.pendingCount,
                  failed_count: sync.failedCount,
                  connectivity_state: connectivity.state,
                })}
              >
                {t('connectivity.banner.actions.retrySync')}
              </button>
            )}

            {showOutageState && (
              <Link
                to={supportContactPath}
                onClick={() => {
                  trackEvent('trip_connectivity__banner--contact', {
                    connectivity_state: connectivity.state,
                    pending_count: sync.pendingCount,
                  });
                }}
                className={`inline-flex h-8 items-center gap-1 rounded-md border px-3 text-xs font-semibold ${bannerTone.button}`}
                {...getAnalyticsDebugAttributes('trip_connectivity__banner--contact', {
                  connectivity_state: connectivity.state,
                  pending_count: sync.pendingCount,
                })}
              >
                <LifeBuoy className="h-3.5 w-3.5" />
                {t('connectivity.banner.actions.contact')}
              </Link>
            )}

            {showOutageState && (
              <a
                href={supportEmailHref}
                onClick={() => {
                  trackEvent('trip_connectivity__banner--email', {
                    connectivity_state: connectivity.state,
                    pending_count: sync.pendingCount,
                  });
                }}
                className={`inline-flex h-8 items-center gap-1 rounded-md border px-3 text-xs font-semibold ${bannerTone.button}`}
                {...getAnalyticsDebugAttributes('trip_connectivity__banner--email', {
                  connectivity_state: connectivity.state,
                  pending_count: sync.pendingCount,
                })}
              >
                <Mail className="h-3.5 w-3.5" />
                {t('connectivity.banner.actions.email')}
              </a>
            )}

            {showOutageState && (
              <button
                type="button"
                onClick={() => {
                  setDismissedForState(connectivity.state);
                  writeSessionStorageItem(DISMISSED_STATE_STORAGE_KEY, connectivity.state);
                  trackEvent('trip_connectivity__banner--dismiss', {
                    connectivity_state: connectivity.state,
                    pending_count: sync.pendingCount,
                  });
                }}
                className={`inline-flex h-8 w-8 items-center justify-center rounded-md border ${bannerTone.button}`}
                aria-label={t('connectivity.banner.actions.dismiss')}
                {...getAnalyticsDebugAttributes('trip_connectivity__banner--dismiss', {
                  connectivity_state: connectivity.state,
                  pending_count: sync.pendingCount,
                })}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
