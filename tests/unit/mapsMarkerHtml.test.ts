import { describe, expect, it } from 'vitest';

import {
  TRANSPORT_ICON_PATHS,
  buildActivityMarkerHtml,
  buildIdeaMarkerHtml,
  buildTransportMarkerHtml,
  escapeHtml,
  normalizeRotationDegrees,
  resolveCssColorVar,
  resolveTransportIconPath,
} from '../../components/maps/markerHtml';
import { resolveMarkerRenderProfile } from '../../components/maps/markerRenderProfiles';

const profile = resolveMarkerRenderProfile({ mapDockMode: 'docked' });
const hostileTitle = `<img src=x onerror="alert('x')"> & co`;

const decodeTransportSvg = (html: string): string => {
  const match = /src="data:image\/svg\+xml;charset=UTF-8,([^"]+)"/.exec(html);
  expect(match).not.toBeNull();
  return decodeURIComponent((match as RegExpExecArray)[1]);
};

describe('components/maps/markerHtml', () => {
  it('escapes every HTML-significant character', () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&#039;&amp;&#039;&lt;/a&gt;');
  });

  it('escapes an activity title in its tooltip and trims it', () => {
    const html = buildActivityMarkerHtml('food', false, `  ${hostileTitle}  `, profile);

    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain(`onerror="`);
    expect(html).toContain('&lt;img src=x onerror=&quot;alert(&#039;x&#039;)&quot;&gt; &amp; co</div>');
  });

  it('leaves the activity tooltip out for a blank or missing title', () => {
    expect(buildActivityMarkerHtml('food', false, '   ', profile)).not.toContain('activity-marker-tooltip');
    expect(buildActivityMarkerHtml('food', false, undefined, profile)).not.toContain('activity-marker-tooltip');
  });

  it('grows a selected activity pin by the profile boost and rings it', () => {
    const idle = buildActivityMarkerHtml('food', false, 'Lunch', profile);
    const selected = buildActivityMarkerHtml('food', true, 'Lunch', profile);
    const selectedSize = profile.activity.size + profile.activity.selectedBoost;

    expect(idle).toContain(`width:${profile.activity.size}px`);
    expect(idle).toContain('box-shadow:none');
    expect(selected).toContain(`width:${selectedSize}px`);
    expect(selected).toContain('box-shadow:0 0 0 2px #2563eb');
  });

  it('escapes an idea title and marks pending ideas as faded', () => {
    const pending = buildIdeaMarkerHtml('culture', true, hostileTitle, profile);
    const kept = buildIdeaMarkerHtml('culture', false, 'Museum', profile);

    expect(pending).not.toContain('<img src=x');
    expect(pending).toContain('&lt;img src=x onerror=&quot;alert(&#039;x&#039;)&quot;&gt; &amp; co');
    expect(pending).toContain('data-idea-state="pending"');
    expect(pending).toContain('opacity:0.5;filter:saturate(0.45);');
    expect(pending).toContain('border-style:dashed');
    expect(kept).toContain('data-idea-state="kept"');
    expect(kept).not.toContain('opacity:0.5');
    expect(buildIdeaMarkerHtml('culture', false, '  ', profile)).not.toContain('activity-marker-tooltip');
  });

  it('keeps idea pins two pixels smaller than activities, but never below 16px', () => {
    expect(buildIdeaMarkerHtml('food', false, '', profile)).toContain(`width:${profile.activity.size - 2}px`);
    const micro = resolveMarkerRenderProfile({ markerTier: 'micro' });
    expect(buildIdeaMarkerHtml('food', false, '', micro)).toContain('width:16px');
  });

  it('rotates only plane icons, normalised into 0-360 degrees', () => {
    expect(decodeTransportSvg(buildTransportMarkerHtml('plane', '#ff0000', -90, profile))).toContain('rotate(270 128 128)');
    expect(decodeTransportSvg(buildTransportMarkerHtml('train', '#ff0000', 45, profile))).toContain('rotate(0 128 128)');
    expect(normalizeRotationDegrees(725)).toBe(5);
    expect(normalizeRotationDegrees(Number.NaN)).toBe(0);
    expect(normalizeRotationDegrees(undefined)).toBe(0);
  });

  it('sizes the transport badge from the profile and falls back to a dark badge', () => {
    const html = buildTransportMarkerHtml('car', undefined, undefined, profile);
    const svg = decodeTransportSvg(html);

    expect(html).toContain(`width:${profile.transport.size}px;height:${profile.transport.size}px`);
    expect(svg).toContain('fill="#1f2937"');
    expect(svg).toContain(TRANSPORT_ICON_PATHS.car);
  });

  it('falls back to the walking icon for unknown or missing modes', () => {
    expect(resolveTransportIconPath(undefined)).toBe(TRANSPORT_ICON_PATHS.walk);
    expect(resolveTransportIconPath('na')).toBe(TRANSPORT_ICON_PATHS.walk);
    expect(resolveTransportIconPath('hovercraft')).toBe(TRANSPORT_ICON_PATHS.walk);
    expect(resolveTransportIconPath('motorcycle')).toBe(TRANSPORT_ICON_PATHS.motorcycle);
    expect(resolveTransportIconPath('plane')).toBe(TRANSPORT_ICON_PATHS.plane);
  });

  it('returns the CSS variable fallback outside the browser', () => {
    expect(resolveCssColorVar('--tf-accent-500', '#123456')).toBe('#123456');
  });
});
