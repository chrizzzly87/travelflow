import { describe, expect, it } from 'vitest';

import {
  buildBlogCalendarIcs,
  buildGoogleCalendarEventUrl,
  buildOutlookCalendarEventUrl,
  parseBlogCalendarCardConfig,
} from '../../services/blogCalendarCardService';

describe('services/blogCalendarCardService', () => {
  it('parses a valid tf-calendar config', () => {
    const raw = JSON.stringify({
      title: 'Krokusblütenfest 2026',
      description: 'Alle Programmpunkte',
      filename: 'husum-krokus-2026',
      timezone: 'Europe/Berlin',
      events: [
        {
          id: 'market',
          title: 'Markt',
          start: '2026-03-14T10:00:00+01:00',
          end: '2026-03-14T18:00:00+01:00',
          location: 'Schlosshof Husum',
          description: 'Kunsthandwerk und kulinarische Meile',
        },
      ],
    });

    const parsed = parseBlogCalendarCardConfig(raw);
    expect(parsed).toBeTruthy();
    expect(parsed?.title).toBe('Krokusblütenfest 2026');
    expect(parsed?.filename).toBe('husum-krokus-2026');
    expect(parsed?.timezone).toBe('Europe/Berlin');
    expect(parsed?.events).toHaveLength(1);
    expect(parsed?.events[0].location).toBe('Schlosshof Husum');
  });

  it('rejects invalid calendar payloads', () => {
    expect(parseBlogCalendarCardConfig('not json')).toBeNull();
    expect(parseBlogCalendarCardConfig(JSON.stringify({ title: 'X', events: [] }))).toBeNull();
    expect(
      parseBlogCalendarCardConfig(JSON.stringify({
        title: 'X',
        events: [{ title: 'A', start: '2026-03-14T10:00:00+01:00', end: 'invalid' }],
      }))
    ).toBeNull();
  });

  it('builds ICS and provider links from parsed config', () => {
    const parsed = parseBlogCalendarCardConfig(JSON.stringify({
      title: 'Festival',
      events: [
        {
          id: 'event-1',
          title: 'Krönung',
          start: '2026-03-14T11:00:00+01:00',
          end: '2026-03-14T12:00:00+01:00',
          location: 'Altes Rathaus Husum',
          description: 'Krönung der Krokusblütenmajestät',
        },
      ],
    }));

    if (!parsed) {
      throw new Error('Expected parsed calendar config');
    }

    const ics = buildBlogCalendarIcs(parsed);
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('SUMMARY:Krönung');
    expect(ics).toContain('LOCATION:Altes Rathaus Husum');
    expect(ics).toContain('END:VCALENDAR');

    const googleUrl = buildGoogleCalendarEventUrl(parsed.events[0], 'Europe/Berlin');
    expect(googleUrl).toContain('calendar/render');
    expect(googleUrl).toContain('action=TEMPLATE');
    expect(googleUrl).toContain('ctz=Europe%2FBerlin');

    const outlookUrl = buildOutlookCalendarEventUrl(parsed.events[0]);
    expect(outlookUrl).toContain('outlook.live.com');
    expect(outlookUrl).toContain('subject=Kr%C3%B6nung');
    expect(outlookUrl).toContain('location=Altes+Rathaus+Husum');
  });
});
