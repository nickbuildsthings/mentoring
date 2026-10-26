import { formatDay, formatInstant, labels } from './format';
import type {
  Action, Objective, Partnership, Preparation, Profile, ProgressUpdate, ProgressUpdateComment, Session, SessionObjective,
} from './types';

export interface MentoringRecord {
  partnership?: Partnership | null;
  profiles: Profile[];
  objectives: Objective[];
  sessions: Session[];
  session_objectives: SessionObjective[];
  session_preparation: Preparation[];
  actions: Action[];
  progress_updates: ProgressUpdate[];
  progress_update_comments?: ProgressUpdateComment[];
}

export const EXPORT_VERSION = 2;

export function buildJson(data: MentoringRecord, exportedAt = new Date()): string {
  return JSON.stringify(
    {
      format: 'mentoring-workspace-export',
      format_version: EXPORT_VERSION,
      exported_at: exportedAt.toISOString(),
      note: 'Includes archived records. Relationships are expressed as UUID references. Contains no credentials.',
      ...data,
    },
    null,
    2,
  );
}

const quote = (s: string | null | undefined) =>
  (s ?? '').trim().split('\n').map((l) => `> ${l}`).join('\n');

export function buildMarkdown(data: MentoringRecord, exportedAt = new Date()): string {
  const name = (id: string | null) => data.profiles.find((p) => p.id === id)?.display_name ?? 'Unknown';
  const objTitle = (id: string | null) => data.objectives.find((o) => o.id === id)?.title;
  const out: string[] = [];
  const meta = (r: { id: string; created_by: string | null; created_at: string; updated_by: string | null; updated_at: string; archived_at: string | null; archived_by: string | null }) =>
    `*ID \`${r.id}\` · created by ${name(r.created_by)} ${formatInstant(r.created_at)} · last edited by ${name(r.updated_by)} ${formatInstant(r.updated_at)}${r.archived_at ? ` · **archived** by ${name(r.archived_by)} ${formatInstant(r.archived_at)}` : ''}*`;
  const field = (label: string, value: string | null | undefined) => (value && value.trim() ? [`**${label}**`, '', quote(value), ''] : []);

  out.push('# Mentoring record', '', `Exported ${formatInstant(exportedAt.toISOString())} (UK time). Includes archived records.`, '');
  out.push('**Participants**', '', ...data.profiles.map((p) => `- ${p.display_name} (${labels.role[p.role]}) — \`${p.id}\``), '');

  if (data.partnership && (data.partnership.title || data.partnership.purpose || data.partnership.meeting_cadence || data.partnership.working_agreement || data.partnership.review_horizon)) {
    const p = data.partnership;
    out.push('## Mentoring charter', '');
    if (p.title) out.push(`**Focus:** ${p.title}`, '');
    if (p.meeting_cadence) out.push(`**Meeting cadence:** ${p.meeting_cadence}`, '');
    if (p.review_horizon) out.push(`**Review horizon:** ${formatDay(p.review_horizon)}`, '');
    out.push(...field('Overall purpose', p.purpose), ...field('Working agreement', p.working_agreement));
  }

  out.push('## Objectives', '');
  if (!data.objectives.length) out.push('_None._', '');
  for (const o of [...data.objectives].sort((a, b) => a.created_at.localeCompare(b.created_at))) {
    const stageText = o.progress_stage ? ` · Progress: ${labels.stage[o.progress_stage]}` : '';
    out.push(`### ${o.title}`, '', `Status: ${labels.objective[o.status]}${stageText}${o.development_area ? ` · Area: ${o.development_area}` : ''}${o.review_date ? ` · Review date: ${formatDay(o.review_date)}` : ''}`, '', meta(o), '');
    out.push(...field('What successful development looks like', o.success_criteria), ...field('Context', o.context), ...field('Review summary', o.closing_summary));
    if (o.milestones && o.milestones.length > 0) {
      out.push('**Milestones**', '', ...o.milestones.map((m) => `- [${m.done ? 'x' : ' '}] ${m.text}`), '');
    }
    const acts = data.actions.filter((a) => a.objective_id === o.id);
    if (acts.length) out.push('**Linked actions**', '', ...acts.map((a) => `- ${a.title} (${labels.action[a.status]}) — \`${a.id}\``), '');
    const ups = data.progress_updates.filter((u) => u.objective_id === o.id).sort((a, b) => a.occurred_on.localeCompare(b.occurred_on));
    if (ups.length) out.push('**Progress updates**', '', ...ups.map((u) => `- ${formatDay(u.occurred_on)} — ${labels.update[u.type]} by ${name(u.created_by)} — \`${u.id}\``), '');
  }

  out.push('## Sessions', '');
  if (!data.sessions.length) out.push('_None._', '');
  for (const s of [...data.sessions].sort((a, b) => b.scheduled_at.localeCompare(a.scheduled_at))) {
    out.push(`### ${formatInstant(s.scheduled_at)}${s.title ? ` — ${s.title}` : ''}`, '',
      `Status: ${labels.session[s.status]}${s.is_review ? ' · Progress review' : ''}${s.location ? ` · Location: ${s.location}` : ''}${s.meeting_link ? ` · Link: ${s.meeting_link}` : ''}`, '', meta(s), '');
    const linked = data.session_objectives.filter((l) => l.session_id === s.id).map((l) => objTitle(l.objective_id) ?? l.objective_id);
    if (linked.length) out.push(`Objectives covered: ${linked.join('; ')}`, '');
    for (const p of data.session_preparation.filter((x) => x.session_id === s.id)) {
      out.push(`#### Preparation — ${name(p.created_by)}`, '', ...field('Topics to discuss', p.topics), ...field('Recent progress', p.recent_progress), ...field('Difficulties', p.difficulties), ...field('Support needed', p.support_needed));
    }
    out.push(...field('Discussion notes', s.discussion_notes), ...field('Agreed outcomes', s.outcomes));
    if (s.is_review) out.push(...field('Review — what has changed', s.review_changed), ...field('Review — what remains difficult', s.review_difficult), ...field('Review — focus next', s.review_focus));
    const acts = data.actions.filter((a) => a.session_id === s.id);
    if (acts.length) out.push('**Actions from this session**', '', ...acts.map((a) => `- ${a.title} (${labels.role[a.owner_role]}, ${labels.action[a.status]}) — \`${a.id}\``), '');
    const sessUps = data.progress_updates.filter((u) => u.session_id === s.id);
    if (sessUps.length) out.push('**Progress updates from this session**', '', ...sessUps.map((u) => `- ${formatDay(u.occurred_on)} — ${labels.update[u.type]} by ${name(u.created_by)} — \`${u.id}\``), '');
  }

  out.push('## Actions', '');
  if (!data.actions.length) out.push('_None._', '');
  for (const a of [...data.actions].sort((x, y) => x.created_at.localeCompare(y.created_at))) {
    out.push(`### ${a.title}`, '', `Owner: ${labels.role[a.owner_role]} · Status: ${labels.action[a.status]}${a.due_date ? ` · Due: ${formatDay(a.due_date)}` : ''}${a.completed_at ? ` · Completed: ${formatInstant(a.completed_at)}` : ''}`, '');
    if (a.objective_id) out.push(`Objective: ${objTitle(a.objective_id) ?? a.objective_id} (\`${a.objective_id}\`)`, '');
    if (a.session_id) out.push(`Session: \`${a.session_id}\``, '');
    out.push(meta(a), '', ...field('Details', a.description), ...field('Blocked note', a.blocked_note), ...field('Completion note', a.completion_note));
  }

  out.push('## Progress updates', '');
  if (!data.progress_updates.length) out.push('_None._', '');
  const comments = data.progress_update_comments ?? [];
  for (const u of [...data.progress_updates].sort((a, b) => b.occurred_on.localeCompare(a.occurred_on))) {
    out.push(`### ${formatDay(u.occurred_on)} — ${labels.update[u.type]} (${name(u.created_by)})`, '', meta(u), '');
    if (u.objective_id) out.push(`Objective: ${objTitle(u.objective_id) ?? u.objective_id} (\`${u.objective_id}\`)`, '');
    if (u.session_id) out.push(`Session: \`${u.session_id}\``, '');
    out.push(quote(u.content), '');
    if (u.links.length) out.push(...u.links.map((l) => `- ${l}`), '');
    const uComments = comments.filter((c) => c.update_id === u.id && !c.archived_at);
    if (uComments.length) {
      out.push('**Coaching responses**', '');
      for (const c of uComments) {
        out.push(`- **${name(c.created_by)}** (${formatInstant(c.created_at)}): ${c.content}`);
      }
      out.push('');
    }
  }
  return out.join('\n');
}

/**
 * Builds a curated, shareable Development Portfolio in Markdown (REC-021).
 * Includes Charter purpose, active/achieved Objectives, Milestones, Achievements,
 * Evidence, Feedback, and Completed Actions, while omitting archived items,
 * raw session discussion notes, personal difficulties, and blocked notes.
 */
export function buildPortfolioMarkdown(data: MentoringRecord, exportedAt = new Date()): string {
  const name = (id: string | null) => data.profiles.find((p) => p.id === id)?.display_name ?? 'Unknown';
  const objTitle = (id: string | null) => data.objectives.find((o) => o.id === id)?.title;
  const out: string[] = [];
  const field = (label: string, value: string | null | undefined) => (value && value.trim() ? [`**${label}**`, '', quote(value), ''] : []);

  out.push('# Development Portfolio & Mentoring Summary', '', `Prepared ${formatInstant(exportedAt.toISOString())} (UK time).`, '');
  out.push('**Participants**', '', ...data.profiles.map((p) => `- ${p.display_name} (${labels.role[p.role]})`), '');

  if (data.partnership && (data.partnership.title || data.partnership.purpose)) {
    out.push('## Mentoring Purpose', '');
    if (data.partnership.title) out.push(`**Focus:** ${data.partnership.title}`, '');
    out.push(...field('Purpose', data.partnership.purpose));
  }

  const activeOrAchieved = data.objectives
    .filter((o) => !o.archived_at && (o.status === 'active' || o.status === 'achieved'))
    .sort((a, b) => a.created_at.localeCompare(b.created_at));

  out.push('## Development Objectives', '');
  if (!activeOrAchieved.length) out.push('_No active or achieved objectives recorded._', '');
  for (const o of activeOrAchieved) {
    const stageText = o.progress_stage ? ` · Stage: ${labels.stage[o.progress_stage]}` : '';
    out.push(`### ${o.title}`, '', `Status: ${labels.objective[o.status]}${stageText}${o.development_area ? ` · Area: ${o.development_area}` : ''}`, '');
    out.push(...field('Success criteria', o.success_criteria), ...field('Review summary', o.closing_summary));
    if (o.milestones && o.milestones.length > 0) {
      out.push('**Milestones**', '', ...o.milestones.map((m) => `- [${m.done ? 'x' : ' '}] ${m.text}`), '');
    }
  }

  const portfolioUpdates = data.progress_updates
    .filter((u) => !u.archived_at && (u.type === 'achievement' || u.type === 'evidence' || u.type === 'feedback'))
    .sort((a, b) => b.occurred_on.localeCompare(a.occurred_on));

  out.push('## Achievements, Evidence & Feedback', '');
  if (!portfolioUpdates.length) out.push('_None recorded yet._', '');
  for (const u of portfolioUpdates) {
    out.push(`### ${formatDay(u.occurred_on)} — ${labels.update[u.type]} (${name(u.created_by)})`, '');
    if (u.objective_id) out.push(`Objective: ${objTitle(u.objective_id) ?? u.objective_id}`, '');
    out.push(quote(u.content), '');
    if (u.links.length) out.push(...u.links.map((l) => `- ${l}`), '');
  }

  const completedActions = data.actions
    .filter((a) => !a.archived_at && a.status === 'completed')
    .sort((a, b) => (b.completed_at ?? b.updated_at).localeCompare(a.completed_at ?? a.updated_at));

  out.push('## Completed Actions', '');
  if (!completedActions.length) out.push('_None completed yet._', '');
  for (const a of completedActions) {
    out.push(`- **${a.title}** (${labels.role[a.owner_role]}${a.completed_at ? `, completed ${formatInstant(a.completed_at)}` : ''})${a.completion_note ? ` — ${a.completion_note}` : ''}`);
  }
  out.push('');

  return out.join('\n');
}
