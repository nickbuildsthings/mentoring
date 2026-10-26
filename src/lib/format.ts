export const TIME_ZONE = 'Europe/London';

const dateFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const dateTimeFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
const isoDayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });

/** A calendar date ("YYYY-MM-DD") has no time zone; format it without shifting. */
export function formatDay(day: string | null | undefined): string {
  if (!day) return '';
  const [y, m, d] = day.split('-').map(Number);
  return dateFmt.format(new Date(Date.UTC(y, m - 1, d, 12)));
}

export function formatInstant(iso: string | null | undefined): string {
  return iso ? dateTimeFmt.format(new Date(iso)) : '';
}

/** Today's calendar date in Europe/London, as YYYY-MM-DD. */
export function todayLondon(now: Date = new Date()): string {
  return isoDayFmt.format(now);
}

/** The London calendar date of an instant, as YYYY-MM-DD. */
export function dayOfInstant(iso: string): string {
  return isoDayFmt.format(new Date(iso));
}

function partsOf(date: Date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  return { y: get('year'), mo: get('month'), d: get('day'), h: get('hour'), mi: get('minute') };
}

/** ISO instant -> "YYYY-MM-MMTHH:mm" as wall-clock time in Europe/London (for datetime-local inputs). */
export function isoToLondonLocal(iso: string): string {
  const p = partsOf(new Date(iso));
  const z = (n: number) => String(n).padStart(2, '0');
  return `${p.y}-${z(p.mo)}-${z(p.d)}T${z(p.h)}:${z(p.mi)}`;
}

/** "YYYY-MM-DDTHH:mm" read as Europe/London wall-clock time -> ISO instant. */
export function londonLocalToIso(local: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!m) throw new Error('Invalid date and time');
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const wanted = Date.UTC(y, mo - 1, d, h, mi);
  let guess = wanted;
  for (let i = 0; i < 3; i++) {
    const p = partsOf(new Date(guess));
    const shown = Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi);
    const diff = wanted - shown;
    if (diff === 0) break;
    guess += diff;
  }
  return new Date(guess).toISOString();
}

export function isOverdue(a: { due_date: string | null; status: string }, today = todayLondon()): boolean {
  return !!a.due_date && a.due_date < today && a.status !== 'completed' && a.status !== 'cancelled';
}

/**
 * Checks whether an active objective has had no activity (update, action, or session)
 * within the past `days` days (default 30), or has a past review_date (REC-020).
 */
export function isObjectiveStalled(
  objective: { id: string; status: string; updated_at?: string; created_at: string; archived_at?: string | null },
  activityOrUpdates: Array<string | { objective_id: string | null; occurred_on: string; archived_at?: string | null }>,
  nowOrToday: number | string = Date.now(),
  days = 30,
): boolean {
  if (objective.status !== 'active' || objective.archived_at) return false;
  const dateStrings = activityOrUpdates.flatMap((item) => {
    if (typeof item === 'string') return [item];
    if (item.archived_at || item.objective_id !== objective.id) return [];
    return [item.occurred_on];
  });
  const all = [objective.created_at, objective.updated_at, ...dateStrings].filter((x): x is string => Boolean(x));
  const latestMs = Math.max(...all.map((d) => new Date(d).getTime()));
  const nowMs = typeof nowOrToday === 'number' ? nowOrToday : new Date(nowOrToday).getTime();
  return nowMs - latestMs > days * 86_400_000;
}

export const labels = {
  objective: { proposed: 'Proposed', active: 'Active', achieved: 'Achieved', paused: 'Paused', closed: 'Closed' },
  stage: {
    starting: 'Starting out',
    building: 'Building capability',
    confident: 'Gaining confidence',
    embedded: 'Embedded in practice',
  },
  partnership: { pending: 'Invite pending', active: 'Active', paused: 'Paused', completed: 'Completed' },
  session: { planned: 'Planned', completed: 'Completed', cancelled: 'Cancelled' },
  action: { not_started: 'Not started', in_progress: 'In progress', blocked: 'Blocked', completed: 'Completed', cancelled: 'Cancelled' },
  update: { reflection: 'Reflection', evidence: 'Evidence', feedback: 'Feedback', achievement: 'Achievement' },
  role: { mentor: 'Mentor', mentee: 'Mentee' },
} as const;

export const DEVELOPMENT_AREAS = ['Skills', 'Knowledge', 'Communication', 'Professional judgement', 'Confidence'];
