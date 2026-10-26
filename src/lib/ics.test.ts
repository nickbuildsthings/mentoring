import { describe, expect, it } from 'vitest';
import { buildSessionIcs } from './ics';

describe('buildSessionIcs (REC-013)', () => {
  it('generates a valid RFC 5545 VCALENDAR with VEVENT fields', () => {
    const ics = buildSessionIcs(
      {
        id: 's-123',
        scheduled_at: '2026-07-01T13:30:00.000Z',
        title: 'Mid-year check-in',
        location: 'Room 4B, London',
        meeting_link: 'https://meet.example.com/abc',
        is_review: true,
      },
      'Ada Lovelace',
    );
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('UID:session-s-123@mentoring-workspace');
    expect(ics).toContain('DTSTART:20260701T133000Z');
    expect(ics).toContain('DTEND:20260701T143000Z');
    expect(ics).toContain('SUMMARY:Mid-year check-in (Ada Lovelace)');
    expect(ics).toContain('LOCATION:Room 4B\\, London');
    expect(ics).toContain('URL:https://meet.example.com/abc');
    expect(ics).toContain('END:VEVENT');
    expect(ics).toContain('END:VCALENDAR');
  });
});
