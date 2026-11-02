/**
 * Where a pin's hover tooltip sits, shared by the Google and Mapbox renderers.
 *
 * The tooltip is anchored with `bottom: 100%`, so it already starts at the top
 * of the pin; the transform only nudges it. It used to translate by its own
 * height as well, which floated it a whole tooltip away from its pin, where the
 * neighbouring pins covered it.
 */
export const MARKER_TOOLTIP_HIDDEN_TRANSFORM = 'translate(-50%, -2px)';
export const MARKER_TOOLTIP_SHOWN_TRANSFORM = 'translate(-50%, -6px)';

/**
 * A hovered pin is lifted above every other marker, so its tooltip is never
 * drawn underneath a neighbour. Above the selected-pin layers, below popovers.
 */
export const MARKER_HOVER_Z_INDEX = 900;
