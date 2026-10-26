import { describe, expect, it } from 'vitest';
import { buildJson, buildMarkdown, buildPortfolioMarkdown, EXPORT_VERSION, type MentoringRecord } from './export';

const stamp = { created_at: '2026-03-01T10:00:00Z', created_by: 'u1', updated_at: '2026-03-01T10:00:00Z', updated_by: 'u1', version: 1, archived_at: null, archived_by: null };
const data: MentoringRecord = {
  partnership: {
    ...stamp,
    id: 'part1',
    mentor_id: 'u2',
    mentee_id: 'u1',
    mentee_name: 'Ada',
    title: 'Engineering Leadership',
    status: 'active',
    purpose: 'Step into staff-level leadership',
    meeting_cadence: 'Fortnightly on Thursdays',
    working_agreement: 'Candid feedback and shared prep 24h before',
    review_horizon: '2026-09-01',
  },
  profiles: [{ id: 'u1', display_name: 'Ada', role: 'mentee' }, { id: 'u2', display_name: 'Bo', role: 'mentor' }],
  objectives: [
    { ...stamp, id: 'o1', title: 'Delegate', success_criteria: 'Hands over work', context: null, development_area: 'Skills', status: 'active', progress_stage: 'building', milestones: [{ id: 'm1', text: 'Hand over sprint planning', done: true }], review_date: '2026-06-01', closing_summary: null, archived_at: '2026-04-01T10:00:00Z', archived_by: 'u2' },
    { ...stamp, id: 'o2', title: 'Architecture reviews', success_criteria: 'Chairs 3 RFC reviews', context: null, development_area: 'Professional judgement', status: 'active', progress_stage: 'confident', milestones: [{ id: 'm2', text: 'Chair first RFC', done: true }], review_date: '2026-07-01', closing_summary: null },
  ],
  sessions: [{ ...stamp, id: 's1', scheduled_at: '2026-03-05T14:00:00Z', title: 'First', location: null, meeting_link: null, status: 'completed', is_review: false, discussion_notes: 'Confidential session discussion\nabout things', outcomes: 'Agreed X', review_changed: null, review_difficult: null, review_focus: null }],
  session_objectives: [{ session_id: 's1', objective_id: 'o1', created_at: stamp.created_at, created_by: 'u1' }],
  session_preparation: [{ ...stamp, id: 'prep1', session_id: 's1', topics: 'My topics', recent_progress: null, difficulties: 'Private difficulty detail', support_needed: null }],
  actions: [{ ...stamp, id: 'a1', title: 'Draft plan', description: null, owner_role: 'mentee', due_date: '2026-03-12', status: 'completed', objective_id: 'o1', session_id: 's1', completed_at: '2026-03-10T09:00:00Z', completion_note: 'Done', blocked_note: 'Internal blocker detail' }],
  progress_updates: [
    { ...stamp, id: 'p1', type: 'achievement', content: 'Led the meeting', links: ['https://example.test/x'], occurred_on: '2026-03-20', objective_id: 'o2', session_id: 's1' },
    { ...stamp, id: 'p2', type: 'reflection', content: 'Personal candid reflection', links: [], occurred_on: '2026-03-21', objective_id: 'o2', session_id: null },
  ],
  progress_update_comments: [
    { ...stamp, id: 'c1', update_id: 'p1', created_by: 'u2', content: 'Well done on leading this!' },
  ],
};

describe('export', () => {
  it('JSON keeps ids, relationships, archived records and no credentials', () => {
    const json = JSON.parse(buildJson(data, new Date('2026-04-01T00:00:00Z')));
    expect(json.format_version).toBe(EXPORT_VERSION);
    expect(json.objectives[0].archived_at).toBeTruthy();
    expect(json.actions[0].objective_id).toBe('o1');
    expect(json.session_objectives[0]).toMatchObject({ session_id: 's1', objective_id: 'o1' });
    expect(JSON.stringify(json)).not.toMatch(/password|token|secret\b|email/i);
  });
  it('Markdown is readable, attributed, and includes charter, session updates, milestones, and comments', () => {
    const md = buildMarkdown(data, new Date('2026-04-01T00:00:00Z'));
    expect(md).toContain('# Mentoring record');
    expect(md).toContain('## Mentoring charter');
    expect(md).toContain('Step into staff-level leadership');
    expect(md).toContain('### Delegate');
    expect(md).toContain('**archived** by Bo');
    expect(md).toContain('- [x] Hand over sprint planning');
    expect(md).toContain('> Confidential session discussion\n> about things');
    expect(md).toContain('**Progress updates from this session**');
    expect(md).toContain('`a1`');
    expect(md).toContain('Led the meeting');
    expect(md).toContain('Well done on leading this!');
  });
  it('Portfolio Markdown includes active/achieved objectives, achievements, and completed actions while excluding raw session notes, reflections, and archived records (REC-021)', () => {
    const portfolio = buildPortfolioMarkdown(data, new Date('2026-04-01T00:00:00Z'));
    expect(portfolio).toContain('# Development Portfolio & Mentoring Summary');
    expect(portfolio).toContain('Step into staff-level leadership');
    expect(portfolio).toContain('### Architecture reviews');
    expect(portfolio).toContain('- [x] Chair first RFC');
    expect(portfolio).toContain('Led the meeting');
    expect(portfolio).toContain('**Draft plan**');
    expect(portfolio).not.toContain('### Delegate'); // archived objective excluded
    expect(portfolio).not.toContain('Confidential session discussion'); // raw session notes excluded
    expect(portfolio).not.toContain('Private difficulty detail'); // prep difficulties excluded
    expect(portfolio).not.toContain('Personal candid reflection'); // personal reflection excluded
    expect(portfolio).not.toContain('Internal blocker detail'); // internal blocked note excluded
  });
});
