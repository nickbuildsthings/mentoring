import { describe, expect, it } from 'vitest';
import { formatDay, isOverdue, isoToLondonLocal, londonLocalToIso, todayLondon } from './format';

describe('Europe/London handling', () => {
  it('converts BST wall-clock time to UTC', () => {
    expect(londonLocalToIso('2026-07-01T14:30')).toBe('2026-07-01T13:30:00.000Z');
  });
  it('converts GMT wall-clock time to UTC', () => {
    expect(londonLocalToIso('2026-01-15T14:30')).toBe('2026-01-15T14:30:00.000Z');
  });
  it('round-trips across the autumn clock change', () => {
    for (const v of ['2026-10-25T00:30', '2026-10-25T03:00', '2026-03-29T03:00']) {
      expect(isoToLondonLocal(londonLocalToIso(v))).toBe(v);
    }
  });
  it('uses the London date for "today"', () => {
    expect(todayLondon(new Date('2026-07-01T23:30:00Z'))).toBe('2026-07-02');
  });
  it('formats calendar dates without shifting', () => {
    expect(formatDay('2026-03-01')).toContain('1 Mar 2026');
  });
});

describe('overdue', () => {
  const today = '2026-06-10';
  it('flags open actions due before today', () => {
    expect(isOverdue({ due_date: '2026-06-09', status: 'in_progress' }, today)).toBe(true);
    expect(isOverdue({ due_date: '2026-06-09', status: 'blocked' }, today)).toBe(true);
  });
  it('does not flag due-today, undated, completed or cancelled actions', () => {
    expect(isOverdue({ due_date: '2026-06-10', status: 'not_started' }, today)).toBe(false);
    expect(isOverdue({ due_date: null, status: 'not_started' }, today)).toBe(false);
    expect(isOverdue({ due_date: '2026-06-01', status: 'completed' }, today)).toBe(false);
    expect(isOverdue({ due_date: '2026-06-01', status: 'cancelled' }, today)).toBe(false);
  });
});
