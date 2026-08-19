import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getAnalyticsDebugAttributes, trackEvent } from '../../services/analyticsService';
import type { CountryExplorerEntry, CountryMonthInsight } from '../../services/countryExplorerService';
import {
  buildCountryMapNodes,
  listCountriesNeedingMarker,
  projectToMapPoint,
  sortCountryCodesForKeyboardNavigation,
  type CountryMapNode,
  type CountryMapProjection,
  type CountryMapTone,
} from '../../services/countryMapPresentation';
import { getCountryAnchor } from '../../services/countryDistanceService';
import countryMapGeometry from '../../data/countryMapGeometry.generated.json';

/**
 * Interactive world map for the countries explorer.
 *
 * ## Why inline SVG and not `mapbox-gl`
 * `mapbox-gl` is already a dependency, but it costs ~230 kB gzip of JS plus a WebGL context, a
 * network round-trip per tile and an access token — for a view that never pans, never zooms and
 * only ever needs one static, low-detail world outline. The geometry here is pre-projected at
 * build time into 173 plain SVG paths (`data/countryMapGeometry.generated.json`, ~30 kB gzip)
 * that live *only* in this lazily-imported chunk. Hit-testing, hover and focus then come free
 * from the DOM, which is also what makes the keyboard and screen-reader story below possible.
 *
 * ## The map is a view, never a source of truth
 * Every decision about how a country should look is made by the pure
 * {@link ../../services/countryMapPresentation} model from the same explorer state that renders
 * the grid, so the two can never disagree. This component only paints and forwards intent.
 *
 * ## Accessibility
 * - Guide countries are real links (SVG `<a href>`), so Enter activates them natively and they
 *   are announced as links with the country name, its region and the selected month's insight.
 * - They share a roving tabindex (one tab stop for the whole map, arrow keys / Home / End to move
 *   west-to-east), so the map never adds 50+ tab stops in front of the grid.
 * - Hover and focus feed the same live region, so the tooltip is not a sighted-only affordance.
 * - The grid below is a complete, independent alternative: if this chunk never loads, nothing is
 *   lost but the picture.
 *
 * ## Direction
 * The map is geographic, so it must *not* mirror in RTL — Japan stays east of Portugal. The
 * positioning context is therefore pinned to `dir="ltr"` and the tooltip's own text is handed
 * back the document direction. All surrounding chrome uses logical properties as usual.
 */

const PROJECTION = countryMapGeometry.projection as CountryMapProjection & { kind: string };

interface CountryMapGeometryShape {
  countryCode: string;
  name: string;
  d: string;
}

const GEOMETRY: CountryMapGeometryShape[] = countryMapGeometry.countries as CountryMapGeometryShape[];
const GEOMETRY_CODES: ReadonlySet<string> = new Set(GEOMETRY.map((shape) => shape.countryCode));

/**
 * Fill/stroke per tone. `land` is deliberately low-contrast furniture, and `muted` sits between
 * it and the active tones so a filtered-out guide country visibly recedes without disappearing.
 */
const TONE_CLASS: Record<CountryMapTone, string> = {
  ideal: 'fill-emerald-500/85 stroke-white',
  shoulder: 'fill-amber-400/85 stroke-white',
  avoid: 'fill-slate-400/70 stroke-white',
  match: 'fill-accent-500/85 stroke-white',
  muted: 'fill-slate-200 stroke-white',
  land: 'fill-slate-100 stroke-white',
};

const MARKER_RADIUS = 4;

interface CountryExplorerMapProps {
  /** Every country that has a guide, in editorial order. */
  entries: CountryExplorerEntry[];
  /** Codes surviving the current search + filters — drives which countries recede. */
  visibleCountryCodes: ReadonlySet<string>;
  month: number | null;
  /** Localized short month names, index 0 = January. */
  monthLabels: string[];
  buildHref: (slug: string) => string;
  /** Per-country month insight, only while a month is selected. */
  getInsight: (entry: CountryExplorerEntry) => CountryMonthInsight | undefined;
  /** Straight-line distances in km, only while sorting by distance. */
  distanceKmByCountry?: ReadonlyMap<string, number>;
  /** Localized, already-rounded distance label, e.g. "≈ 8,400 km away". */
  formatDistance?: (distanceKm: number) => string;
  direction: 'ltr' | 'rtl';
}

/**
 * Pointer and keyboard hovers are tracked separately and the pointer simply wins while it is over
 * a country. Merging them into one slot loses the keyboard's place: moving the mouse across the
 * map and off again would silently drop the tooltip belonging to the still-focused country.
 */
interface HoverState {
  pointerCountryCode: string | null;
  focusCountryCode: string | null;
}

const NO_HOVER: HoverState = { pointerCountryCode: null, focusCountryCode: null };

const CountryExplorerMapComponent: React.FC<CountryExplorerMapProps> = ({
  entries,
  visibleCountryCodes,
  month,
  monthLabels,
  buildHref,
  getInsight,
  distanceKmByCountry,
  formatDistance,
  direction,
}) => {
  const { t } = useTranslation('pages');
  const navigate = useNavigate();
  const svgRef = useRef<SVGSVGElement | null>(null);

  const [hover, setHover] = useState<HoverState>(NO_HOVER);
  /** Set when a country we have no guide for is clicked, so the click is never a silent no-op. */
  const [missingGuideName, setMissingGuideName] = useState<string | null>(null);

  const hoveredCountryCode = hover.pointerCountryCode ?? hover.focusCountryCode;

  const enterPointer = useCallback((countryCode: string) => {
    setHover((current) => ({ ...current, pointerCountryCode: countryCode }));
  }, []);

  const leavePointer = useCallback((countryCode: string) => {
    setHover((current) => (
      current.pointerCountryCode === countryCode ? { ...current, pointerCountryCode: null } : current
    ));
  }, []);

  const guidesByCountryCode = useMemo(() => {
    const index = new Map<string, CountryExplorerEntry>();
    entries.forEach((entry) => index.set(entry.countryCode, entry));
    return index;
  }, [entries]);

  const nodes = useMemo(() => buildCountryMapNodes({
    geometryCodes: GEOMETRY,
    guidesByCountryCode,
    visibleCountryCodes,
    month,
  }), [guidesByCountryCode, visibleCountryCodes, month]);

  const nodeByCountryCode = useMemo(() => {
    const index = new Map<string, CountryMapNode>();
    nodes.forEach((node) => index.set(node.countryCode, node));
    return index;
  }, [nodes]);

  /**
   * Guide countries the 1:110m atlas cannot draw (Singapore, Maldives, Barbados, …) plus a
   * projected point for every guide country, used both for the markers and for anchoring the
   * tooltip to a stable place instead of to the pointer.
   */
  const { markers, pointByCountryCode } = useMemo(() => {
    const points = new Map<string, { x: number; y: number }>();
    const dots: Array<{ countryCode: string; name: string; x: number; y: number; tone: CountryMapTone }> = [];

    // Every country on the atlas, not just the ones with a guide: the tooltip has to be able to
    // anchor itself over a country we do not cover so its "no guide yet" hint can be seen at all.
    GEOMETRY.forEach((shape) => {
      const anchor = getCountryAnchor(shape.countryCode);
      if (!anchor) return;
      const point = projectToMapPoint(anchor.latitude, anchor.longitude, PROJECTION);
      if (point) points.set(shape.countryCode, point);
    });

    guidesByCountryCode.forEach((_entry, countryCode) => {
      if (points.has(countryCode)) return;
      const anchor = getCountryAnchor(countryCode);
      if (!anchor) return;
      const point = projectToMapPoint(anchor.latitude, anchor.longitude, PROJECTION);
      if (point) points.set(countryCode, point);
    });

    listCountriesNeedingMarker(guidesByCountryCode, GEOMETRY_CODES).forEach((countryCode) => {
      const point = points.get(countryCode);
      const node = nodeByCountryCode.get(countryCode);
      const entry = guidesByCountryCode.get(countryCode);
      if (!point || !entry) return;
      dots.push({
        countryCode,
        name: entry.name,
        x: point.x,
        y: point.y,
        // Marker countries have no geometry, so they are absent from `nodes`; derive their tone
        // from the same rules rather than defaulting them to `match`.
        tone: node?.tone
          ?? (visibleCountryCodes.has(countryCode)
            ? (month === null ? 'match' : entry.seasonBands[month - 1])
            : 'muted'),
      });
    });

    return { markers: dots, pointByCountryCode: points };
  }, [guidesByCountryCode, nodeByCountryCode, visibleCountryCodes, month]);

  /** West-to-east tab order across everything that is actually reachable by keyboard. */
  const keyboardOrder = useMemo(() => sortCountryCodesForKeyboardNavigation(
    [
      ...nodes.filter((node) => node.hasGuide).map((node) => node.countryCode),
      ...markers.map((marker) => marker.countryCode),
    ],
    pointByCountryCode,
  ), [nodes, markers, pointByCountryCode]);

  /**
   * Roving tabindex anchor. Kept as a country code rather than an index so it survives a filter
   * change that reorders the map, and clamped at render time so it can never point at nothing.
   */
  const [rovingCountryCode, setRovingCountryCode] = useState<string | null>(null);
  const activeRovingCode = rovingCountryCode && keyboardOrder.includes(rovingCountryCode)
    ? rovingCountryCode
    : keyboardOrder[0] ?? null;

  const focusCountry = useCallback((countryCode: string) => {
    setRovingCountryCode(countryCode);
    setHover((current) => ({ ...current, focusCountryCode: countryCode }));
    const target = svgRef.current?.querySelector<SVGElement>(`[data-country-code="${countryCode}"]`);
    target?.focus();
  }, []);

  const handleKeyDown = useCallback((event: React.KeyboardEvent, countryCode: string) => {
    const index = keyboardOrder.indexOf(countryCode);
    if (index === -1) return;

    let nextIndex: number | null = null;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = index + 1;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = index - 1;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = keyboardOrder.length - 1;
    else if (event.key === 'Escape') {
      setHover(NO_HOVER);
      setMissingGuideName(null);
      return;
    } else return;

    event.preventDefault();
    const clamped = Math.min(Math.max(nextIndex, 0), keyboardOrder.length - 1);
    const nextCountryCode = keyboardOrder[clamped];
    if (nextCountryCode) focusCountry(nextCountryCode);
  }, [keyboardOrder, focusCountry]);

  const handleActivateGuide = useCallback((
    event: React.MouseEvent,
    entry: CountryExplorerEntry,
    href: string,
  ) => {
    // Let the browser own modified clicks (new tab, download, middle click) — it is a real link.
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    trackEvent('inspirations__country_map', {
      country: entry.name,
      country_code: entry.countryCode,
      month: month ?? 0,
      in_results: visibleCountryCodes.has(entry.countryCode) ? 1 : 0,
    });
    navigate(href);
  }, [navigate, month, visibleCountryCodes]);

  const handleActivateMissing = useCallback((countryName: string) => {
    trackEvent('inspirations__country_map--no_guide', { country: countryName });
    setMissingGuideName(countryName);
  }, []);

  const hoveredEntry = hoveredCountryCode ? guidesByCountryCode.get(hoveredCountryCode) : undefined;
  const hoveredPoint = hoveredCountryCode ? pointByCountryCode.get(hoveredCountryCode) : undefined;
  const hoveredInsight = hoveredEntry && month !== null ? getInsight(hoveredEntry) : undefined;
  const hoveredDistanceKm = hoveredEntry ? distanceKmByCountry?.get(hoveredEntry.countryCode) : undefined;
  const hoveredName = hoveredEntry?.name
    ?? (hoveredCountryCode
      ? GEOMETRY.find((shape) => shape.countryCode === hoveredCountryCode)?.name
      : undefined);

  /**
   * One sentence per country, reused verbatim as the link's accessible name and as the live-region
   * announcement, so pointer and screen-reader users are told exactly the same thing.
   */
  const describeCountry = useCallback((entry: CountryExplorerEntry): string => {
    const insight = month === null ? undefined : getInsight(entry);
    const parts = [entry.name, entry.region];
    if (insight) {
      parts.push(t(`inspirations.subpages.explorer.band.${insight.band}`));
      parts.push(monthLabels[insight.month - 1] ?? '');
    }
    if (!visibleCountryCodes.has(entry.countryCode)) {
      parts.push(t('inspirations.subpages.map.filteredOut'));
    }
    return parts.filter(Boolean).join(', ');
  }, [month, getInsight, monthLabels, t, visibleCountryCodes]);

  const renderInteractive = (
    countryCode: string,
    entry: CountryExplorerEntry,
    child: React.ReactNode,
  ) => {
    const href = buildHref(entry.slug);
    return (
      <a
        key={countryCode}
        href={href}
        data-country-code={countryCode}
        tabIndex={activeRovingCode === countryCode ? 0 : -1}
        aria-label={describeCountry(entry)}
        className="cursor-pointer outline-none [&:focus-visible>*]:stroke-accent-700 [&:focus-visible>*]:[stroke-width:1.6] [&:hover>*]:stroke-slate-900 [&:hover>*]:[stroke-width:1.2]"
        onClick={(event) => handleActivateGuide(event, entry, href)}
        onKeyDown={(event) => handleKeyDown(event, countryCode)}
        onFocus={() => setHover((current) => ({ ...current, focusCountryCode: countryCode }))}
        onBlur={() => setHover((current) => (
          current.focusCountryCode === countryCode ? { ...current, focusCountryCode: null } : current
        ))}
        onPointerEnter={() => enterPointer(countryCode)}
        onPointerLeave={() => leavePointer(countryCode)}
      >
        {child}
      </a>
    );
  };

  return (
    <figure className="m-0">
      <div
        // Geographic, so it must not mirror: east stays east in RTL locales.
        dir="ltr"
        className="relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-b from-sky-50 to-white"
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${PROJECTION.width} ${PROJECTION.height}`}
          className="block h-auto w-full"
          role="group"
          aria-label={t('inspirations.subpages.map.ariaLabel')}
          {...getAnalyticsDebugAttributes('inspirations__country_map')}
        >
          <g strokeWidth={0.5} strokeLinejoin="round">
            {GEOMETRY.map((shape) => {
              const node = nodeByCountryCode.get(shape.countryCode);
              const entry = guidesByCountryCode.get(shape.countryCode);
              const tone = node?.tone ?? 'land';
              const path = (
                <path
                  d={shape.d}
                  className={`${TONE_CLASS[tone]} transition-[fill,stroke] duration-200`}
                  // Countries without a guide are furniture: never focusable, never announced,
                  // but still hoverable and clickable so the click can explain itself.
                  vectorEffect="non-scaling-stroke"
                />
              );

              if (entry) return renderInteractive(shape.countryCode, entry, path);

              return (
                <g
                  key={shape.countryCode}
                  aria-hidden="true"
                  className="cursor-help"
                  onPointerEnter={() => enterPointer(shape.countryCode)}
                  onPointerLeave={() => leavePointer(shape.countryCode)}
                  onClick={() => handleActivateMissing(shape.name)}
                >
                  {path}
                </g>
              );
            })}
          </g>

          {/* Guide countries too small to draw at 1:110m, so they are not silently missing. */}
          <g>
            {markers.map((marker) => {
              const entry = guidesByCountryCode.get(marker.countryCode);
              if (!entry) return null;
              return renderInteractive(marker.countryCode, entry, (
                <circle
                  cx={marker.x}
                  cy={marker.y}
                  r={MARKER_RADIUS}
                  strokeWidth={1}
                  className={`${TONE_CLASS[marker.tone]} transition-[fill,stroke] duration-200`}
                />
              ));
            })}
          </g>
        </svg>

        {hoveredCountryCode && hoveredName && hoveredPoint ? (
          <div
            role="presentation"
            className="pointer-events-none absolute z-10 w-max max-w-56 -translate-x-1/2 -translate-y-[calc(100%+10px)] rounded-xl border border-slate-200 bg-white/95 px-3 py-2 shadow-lg backdrop-blur-sm"
            style={{
              left: `${(hoveredPoint.x / PROJECTION.width) * 100}%`,
              top: `${(hoveredPoint.y / PROJECTION.height) * 100}%`,
            }}
          >
            <div dir={direction} className="text-start">
              <p className="text-xs font-black text-slate-900">{hoveredName}</p>
              {hoveredEntry ? (
                <>
                  <p className="mt-0.5 text-[11px] font-semibold text-slate-500">{hoveredEntry.region}</p>
                  {hoveredInsight ? (
                    <p className="mt-1 text-[11px] font-bold text-accent-700">
                      {t(`inspirations.subpages.explorer.band.${hoveredInsight.band}`)}
                      {hoveredInsight.climate ? ` · ${t('inspirations.subpages.explorer.temperature', {
                        high: Math.round(hoveredInsight.climate.avgHighC),
                        low: Math.round(hoveredInsight.climate.avgLowC),
                      })}` : ''}
                    </p>
                  ) : null}
                  {hoveredDistanceKm !== undefined && formatDistance ? (
                    <p className="mt-1 text-[11px] font-semibold text-slate-500">
                      {formatDistance(hoveredDistanceKm)}
                    </p>
                  ) : null}
                  <p className="mt-1 text-[11px] font-bold text-slate-400">
                    {t('inspirations.subpages.map.openGuide')}
                  </p>
                </>
              ) : (
                <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
                  {t('inspirations.subpages.map.noGuide')}
                </p>
              )}
            </div>
          </div>
        ) : null}
      </div>

      {/*
        Hover and keyboard focus both land here, so the tooltip is not a sighted-only affordance.
        `atomic` keeps partial country names from being announced mid-update.
      */}
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {hoveredEntry ? describeCountry(hoveredEntry) : ''}
      </p>

      {missingGuideName ? (
        <p
          className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-600"
          role="status"
        >
          {t('inspirations.subpages.map.noGuideFor', { country: missingGuideName })}
          <button
            type="button"
            onClick={() => setMissingGuideName(null)}
            className="rounded-full border border-slate-300 px-2.5 py-1 text-[11px] font-bold text-slate-600 transition-colors hover:border-accent-300 hover:text-accent-700"
          >
            {t('inspirations.subpages.map.dismissNotice')}
          </button>
        </p>
      ) : null}

      <figcaption className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] font-semibold text-slate-500">
        {(month === null
          ? (['match', 'muted', 'land'] as CountryMapTone[])
          : (['ideal', 'shoulder', 'avoid', 'muted', 'land'] as CountryMapTone[])
        ).map((tone) => (
          <span key={tone} className="inline-flex items-center gap-1.5">
            <svg className="size-2.5 shrink-0" viewBox="0 0 10 10" aria-hidden="true">
              <circle cx="5" cy="5" r="5" className={TONE_CLASS[tone]} strokeWidth={0} />
            </svg>
            {t(`inspirations.subpages.map.legend.${tone}`)}
          </span>
        ))}
        <span className="w-full text-slate-400">{t('inspirations.subpages.map.keyboardHint')}</span>
      </figcaption>
    </figure>
  );
};

export const CountryExplorerMap = React.memo(CountryExplorerMapComponent);

export default CountryExplorerMap;
