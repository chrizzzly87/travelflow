// @vitest-environment jsdom
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { act, render } from '@testing-library/react';
import { useEffect, useState } from 'react';
import { describe, expect, it } from 'vitest';

import { ActivityTypeIcon } from '../../components/ActivityTypeVisuals';
import { buildActivityIconInnerMarkup, buildActivityIconMarkup } from '../../components/maps/activityIconMarkup';
import { ACTIVITY_TYPE_VALUES } from '../../shared/activityTypes';

const readInnerSvg = (markup: string): string => markup.slice(markup.indexOf('>') + 1, markup.lastIndexOf('</svg>'));

/** Marker effects build SVG strings while React continues rendering live map state. */
const renderMarkerMapThroughTwoUpdates = (buildIcon: (size: number) => string) => {
    let setSize: (size: number) => void = () => {};
    const MarkerMap = ({ size }: { size: number }) => {
        const [label] = useState('markers');
        useEffect(() => { buildIcon(size); }, [size]);
        return React.createElement('div', null, `${label}:${size}`);
    };
    const App = () => {
        const [size, update] = useState(11);
        setSize = update;
        return React.createElement(MarkerMap, { size });
    };
    const view = render(React.createElement(App));
    act(() => setSize(12));
    act(() => setSize(13));
    const text = view.container.textContent;
    view.unmount();
    return text;
};

describe('activity marker icon markup', () => {
    it.each(ACTIVITY_TYPE_VALUES)('draws the same %s glyph as ActivityTypeIcon', (type) => {
        const rendered = renderToStaticMarkup(React.createElement(ActivityTypeIcon, { type, size: 14 }));
        expect(buildActivityIconInnerMarkup(type)).toBe(readInnerSvg(rendered));
        expect(readInnerSvg(buildActivityIconMarkup(type, 14))).toBe(readInnerSvg(rendered));
    });

    it('sizes and styles the marker svg', () => {
        const markup = buildActivityIconMarkup('food', 17);
        expect(markup.startsWith('<svg style="width:17px;height:17px;')).toBe(true);
        expect(markup).toContain('width="17" height="17" viewBox="0 0 24 24"');
        expect(markup.endsWith('</svg>')).toBe(true);
    });

    it('builds marker icons inside a flushed effect without breaking the live render', () => {
        const types = ['nightlife', 'hiking', 'beach'] as const;
        expect(renderMarkerMapThroughTwoUpdates((size) => buildActivityIconMarkup(types[size % types.length], size + 100))).toBe(
            'markers:13',
        );
    });
});
