import type { CanvasGroupDefinition } from './ComponentCanvas';
import { ACTION_GROUPS } from './canvasGroupsActions';
import { DISPLAY_GROUPS } from './canvasGroupsDisplay';
import { FORM_GROUPS } from './canvasGroupsForms';
import { OVERLAY_GROUPS } from './canvasGroupsOverlays';

/** Display order of every group on the canvas. */
export const CANVAS_GROUPS: CanvasGroupDefinition[] = [
    ...ACTION_GROUPS,
    ...FORM_GROUPS,
    ...DISPLAY_GROUPS,
    ...OVERLAY_GROUPS,
];
