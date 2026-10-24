import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { getRouteAccessDecision } from '../../features/auth/routeAccess';
import { validateRouteLocale } from '../../app/routing/localePolicy';
import { exampleTripPreviews } from '../../data/exampleTripPreviews.generated';
import { getExampleTemplateMiniCalendar, TRIP_TEMPLATES } from '../../data/exampleTripTemplates';

describe('native route boundaries', () => {
    it('accepts locale prefixes and rejects invented/default-language prefix aliases', () => {
        for (const locale of [undefined, 'de', 'fa', 'ko', 'ur']) expect(() => validateRouteLocale({ locale })).not.toThrow();
        for (const locale of ['en', 'zz', 'admin']) expect(() => validateRouteLocale({ locale })).toThrow();
    });
    it('requires a verified active non-anonymous account, with a separate admin decision', () => {
        const active = { userId: 'user', isAnonymous: false, accountStatus: 'active', role: 'user' } as any;
        expect(getRouteAccessDecision(null)).toBe('login');
        expect(getRouteAccessDecision({ ...active, isAnonymous: true })).toBe('login');
        expect(getRouteAccessDecision({ ...active, accountStatus: 'disabled' })).toBe('login');
        expect(getRouteAccessDecision(active)).toBe('allow');
        expect(getRouteAccessDecision(active, true)).toBe('denied');
        expect(getRouteAccessDecision({ ...active, role: 'admin' }, true)).toBe('allow');
    });
    it('separates public, trip and admin compositions instead of interpreting the previous route tree', () => {
        const routes = fs.readFileSync('src/virtualRoutes.ts', 'utf8');
        for (const group of ['_public', '_trips', '_create', '_account', '_admin']) expect(routes).toContain(`layout('${group}'`);
        const shell = fs.readFileSync('app/shell/ApplicationShell.tsx', 'utf8');
        for (const heavy of ['TripView', 'useTripPersistence', 'CreateTripV3Page', 'AdminWorkspaceRouter']) expect(shell).not.toContain(heavy);
    });
    it('ships preview-only example data with the same visual content as full trip templates', () => {
        for (const id of Object.keys(TRIP_TEMPLATES)) expect(exampleTripPreviews[id]).toEqual(getExampleTemplateMiniCalendar(id));
    });
});
