import React from 'react';

import { ComponentCanvas } from '../components/admin/componentCanvas/ComponentCanvas';
import { CANVAS_GROUPS } from '../components/admin/componentCanvas/canvasGroups';

/**
 * Unlisted admin canvas of the shared UI primitives. Full screen, no admin
 * shell: the canvas is the page.
 */
export const AdminComponentCanvasPage: React.FC = () => <ComponentCanvas groups={CANVAS_GROUPS} />;
