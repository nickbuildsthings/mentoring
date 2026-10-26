import type { Session } from './types';

function escapeIcsText(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

function toIcsUtcTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

/**
 * Generates an RFC 5545 `.ics` calendar invitation for a mentoring session (REC-013).
 */
export function buildSessionIcs(
  session: Pick<Session, 'id' | 'scheduled_at' | 'title' | 'location' | 'meeting_link' | 'is_review'>,
  partnerName?: string,
  durationMinutes = 60,
): string {
  const start = new Date(session.scheduled_at);
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  const summaryBase = session.title?.trim() || (session.is_review ? 'Mentoring Progress Review' : 'Mentoring Session');
  const summary = partnerName ? `${summaryBase} (${partnerName})` : summaryBase;

  const descParts: string[] = [];
  if (session.is_review) descParts.push('Structured mentoring progress review.');
  if (session.meeting_link) descParts.push(`Meeting link: ${session.meeting_link}`);

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Mentoring Workspace//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:session-${session.id}@mentoring-workspace`,
    `DTSTAMP:${toIcsUtcTimestamp(new Date().toISOString())}`,
    `DTSTART:${toIcsUtcTimestamp(start.toISOString())}`,
    `DTEND:${toIcsUtcTimestamp(end.toISOString())}`,
    `SUMMARY:${escapeIcsText(summary)}`,
  ];

  if (session.location) {
    lines.push(`LOCATION:${escapeIcsText(session.location)}`);
  } else if (session.meeting_link) {
    lines.push(`LOCATION:${escapeIcsText(session.meeting_link)}`);
  }

  if (descParts.length > 0) {
    lines.push(`DESCRIPTION:${escapeIcsText(descParts.join('\n'))}`);
  }
  if (session.meeting_link) {
    lines.push(`URL:${session.meeting_link}`);
  }

  lines.push('END:VEVENT', 'END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}
