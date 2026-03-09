import { useEffect, useRef } from 'react';

interface InfiniteScrollSentinelOptions {
  enabled: boolean;
  hasMore: boolean;
  isLoading: boolean;
  onLoadMore: () => void;
  rootMargin?: string;
}

export const useInfiniteScrollSentinel = ({
  enabled,
  hasMore,
  isLoading,
  onLoadMore,
  rootMargin = '420px 0px',
}: InfiniteScrollSentinelOptions) => {
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const fallbackTriggeredRef = useRef(false);

  useEffect(() => {
    if (!enabled || !hasMore) {
      fallbackTriggeredRef.current = false;
      return;
    }
    if (isLoading) {
      fallbackTriggeredRef.current = false;
      return;
    }

    const node = sentinelRef.current;
    if (!node) return;

    if (typeof window === 'undefined' || typeof window.IntersectionObserver !== 'function') {
      if (fallbackTriggeredRef.current) return;
      fallbackTriggeredRef.current = true;
      onLoadMore();
      return;
    }

    fallbackTriggeredRef.current = false;

    const observer = new window.IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        onLoadMore();
      },
      { rootMargin }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [enabled, hasMore, isLoading, onLoadMore, rootMargin]);

  return sentinelRef;
};
